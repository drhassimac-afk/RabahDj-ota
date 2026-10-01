import { gunzipSync, strFromU8 } from 'fflate';

export interface IPTVProgramme {
  channel: string;
  start: number;
  stop: number;
  title: string;
  description?: string;
}

type EpgChannel = {
  id: string;
  name: string;
};

const epgCache = new Map<
  string,
  {
    loadedAt: number;
    programmes: IPTVProgramme[];
    channels: EpgChannel[];
  }
>();

const CACHE_TTL = 30 * 60 * 1000;

function decodeXmlText(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

function normalizeEpgId(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function parseXmltvDate(value: string): number {
  const normalized = value.trim();

  const match = normalized.match(
    /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/
  );

  if (!match) return NaN;

  const [, year, month, day, hour, minute, second] = match;

  const base = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );

  const timezoneMatch = normalized.match(
    /([+-])(\d{2})(\d{2})$/
  );

  if (!timezoneMatch) {
    return base;
  }

  const sign = timezoneMatch[1] === '+' ? 1 : -1;

  const offsetMinutes =
    Number(timezoneMatch[2]) * 60 +
    Number(timezoneMatch[3]);

  return base - sign * offsetMinutes * 60 * 1000;
}

function extractTag(
  block: string,
  tag: string
): string {
  const regex = new RegExp(
    `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,
    'i'
  );

  return decodeXmlText(
    block.match(regex)?.[1] || ''
  );
}

function extractAttribute(
  value: string,
  attribute: string
): string {
  const regex = new RegExp(
    `${attribute}\\s*=\\s*["']([^"']*)["']`,
    'i'
  );

  return regex.exec(value)?.[1] || '';
}

function parseXmltvChannels(
  xml: string
): EpgChannel[] {
  const channels: EpgChannel[] = [];

  const regex =
    /<channel\b([^>]*)>([\s\S]*?)<\/channel>/gi;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(xml)) !== null) {
    const id = extractAttribute(
      match[1],
      'id'
    );

    if (!id) continue;

    const name =
      extractTag(match[2], 'display-name');

    channels.push({
      id,
      name,
    });
  }

  return channels;
}

function parseXmltv(
  xml: string,
  channelId?: string
): IPTVProgramme[] {
  const programmes: IPTVProgramme[] = [];

  const normalizedTarget = channelId
    ? normalizeEpgId(channelId)
    : '';

  const regex =
    /<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(xml)) !== null) {
    const attributes = match[1];
    const block = match[2];

    const channel =
      extractAttribute(attributes, 'channel');

    if (
      normalizedTarget &&
      normalizeEpgId(channel) !== normalizedTarget
    ) {
      continue;
    }

    const start = parseXmltvDate(
      extractAttribute(attributes, 'start')
    );

    const stop = parseXmltvDate(
      extractAttribute(attributes, 'stop')
    );

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(stop)
    ) {
      continue;
    }

    const title = extractTag(
      block,
      'title'
    );

    if (!title) continue;

    programmes.push({
      channel,
      start,
      stop,
      title,
      description:
        extractTag(block, 'desc') || undefined,
    });
  }

  return programmes.sort(
    (a, b) => a.start - b.start
  );
}

async function downloadXml(
  url: string
): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `EPG HTTP ${response.status}`
    );
  }

  const bytes = new Uint8Array(
    await response.arrayBuffer()
  );

  const isGzip =
    bytes.length >= 2 &&
    bytes[0] === 0x1f &&
    bytes[1] === 0x8b;

  if (
    isGzip ||
    /\.gz(?:$|\?)/i.test(url)
  ) {
    return strFromU8(
      gunzipSync(bytes)
    );
  }

  return strFromU8(bytes);
}

function countryFromTvgId(
  tvgId: string
): string {
  const match =
    tvgId
      .trim()
      .match(/\.([a-z]{2})$/i);

  return (
    match?.[1]?.toUpperCase() || ''
  );
}

function scoreEpgUrl(
  url: string,
  country: string
): number {
  const upper = url.toUpperCase();

  /*
   * Never automatically select the giant
   * ALL_SOURCES feed.
   */
  if (
    upper.includes('ALL_SOURCES')
  ) {
    return -1000;
  }

  if (!country) return 0;

  const countryFile =
    new RegExp(
      `(?:^|[_/-])${country}\\d*\\.XML(?:\\.GZ)?(?:$|\\?)`,
      'i'
    );

  if (countryFile.test(upper)) {
    return 100;
  }

  if (
    upper.includes(`_${country}`) ||
    upper.includes(`/${country}`)
  ) {
    return 80;
  }

  return 0;
}

export function selectEpgUrls(
  epgUrls: string[],
  tvgId: string
): string[] {
  if (!epgUrls.length) {
    return [];
  }

  const country =
    countryFromTvgId(tvgId);

  return [...epgUrls]
    .map(url => ({
      url,
      score: scoreEpgUrl(
        url,
        country
      ),
    }))
    .filter(
      item => item.score >= 0
    )
    .sort(
      (a, b) => b.score - a.score
    )
    .map(
      item => item.url
    )
    .slice(0, 3);
}

async function loadEpgSource(
  url: string
): Promise<{
  programmes: IPTVProgramme[];
  channels: EpgChannel[];
}> {
  const cached = epgCache.get(url);

  if (
    cached &&
    Date.now() - cached.loadedAt <
      CACHE_TTL
  ) {
    return {
      programmes: cached.programmes,
      channels: cached.channels,
    };
  }

  const xml =
    await downloadXml(url);

  const channels =
    parseXmltvChannels(xml);

  const programmes =
    parseXmltv(xml);

  epgCache.set(url, {
    loadedAt: Date.now(),
    programmes,
    channels,
  });

  return {
    programmes,
    channels,
  };
}

function findEpgChannel(
  channels: EpgChannel[],
  tvgId: string
): EpgChannel | null {
  const target =
    normalizeEpgId(tvgId);

  if (!target) return null;

  return (
    channels.find(
      channel =>
        normalizeEpgId(channel.id) ===
        target
    ) || null
  );
}

export async function loadChannelEpg(
  epgUrls: string[],
  tvgId: string
): Promise<IPTVProgramme[]> {
  if (
    !tvgId ||
    !epgUrls.length
  ) {
    return [];
  }

  const candidates =
    selectEpgUrls(
      epgUrls,
      tvgId
    );

  for (const url of candidates) {
    try {
      const source =
        await loadEpgSource(url);

      const matchedChannel =
        findEpgChannel(
          source.channels,
          tvgId
        );

      if (!matchedChannel) {
        continue;
      }

      const target =
        normalizeEpgId(
          matchedChannel.id
        );

      const matches =
        source.programmes.filter(
          programme =>
            normalizeEpgId(
              programme.channel
            ) === target
        );

      if (matches.length) {
        return matches;
      }
    } catch {
      /*
       * Try the next EPG source.
       */
    }
  }

  return [];
}

export async function getCurrentProgramme(
  epgUrls: string[],
  tvgId: string,
  now = Date.now()
): Promise<IPTVProgramme | null> {
  const programmes =
    await loadChannelEpg(
      epgUrls,
      tvgId
    );

  return (
    programmes.find(
      programme =>
        programme.start <= now &&
        programme.stop > now
    ) || null
  );
}

export function clearEpgCache() {
  epgCache.clear();
}
