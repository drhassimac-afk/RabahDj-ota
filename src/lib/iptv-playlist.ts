import { Asset } from 'expo-asset';
import parser from 'iptv-playlist-parser';

export interface IPTVChannel {
  name: string;
  url: string;
  group: string;
  tvgId: string;
  logo: string;

  /**
   * Real catch-up metadata from the M3U entry.
   * Empty/undefined means catch-up is not advertised.
   */
  catchupType?: string;
  catchupDays?: number;
  catchupSource?: string;
  timeshift?: string;
}

export interface IPTVGroup {
  name: string;
  channels: IPTVChannel[];
}

export interface IPTVPlaylist {
  channels: IPTVChannel[];
  epgUrls: string[];
}

const playlistAsset = require('../../assets/iptv/playlist.m3u');

function extractEpgUrls(content: string): string[] {
  const firstLine = content.split(/\r?\n/, 1)[0] || '';
  const urls: string[] = [];

  const attributes = [
    'x-tvg-url',
    'x-xmltv-url',
    'tvg-url',
  ];

  for (const attribute of attributes) {
    const regex = new RegExp(
      `${attribute}\\s*=\\s*["']([^"']+)["']`,
      'i'
    );

    const match = firstLine.match(regex);

    if (!match?.[1]) continue;

    for (const url of match[1].split(/[,\s]+/)) {
      const trimmed = url.trim();

      if (
        trimmed &&
        /^https?:\/\//i.test(trimmed) &&
        !urls.includes(trimmed)
      ) {
        urls.push(trimmed);
      }
    }
  }

  return urls;
}

function parseCatchupNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : undefined;
}

export function parseIPTVPlaylistWithMeta(
  content: string
): IPTVPlaylist {
  const result = parser.parse(content);

  const channels: IPTVChannel[] = result.items.map((item) => {
    const catchup = item.catchup;

    return {
      name: item.name || 'بدون اسم',
      url: item.url || '',
      group: item.group?.title || 'غير مصنف',
      tvgId: item.tvg?.id || '',
      logo: item.tvg?.logo || '',

      catchupType:
        catchup?.type?.trim() || undefined,

      catchupDays:
        parseCatchupNumber(catchup?.days),

      catchupSource:
        catchup?.source?.trim() || undefined,

      timeshift:
        item.timeshift?.trim() || undefined,
    };
  });

  return {
    channels,
    epgUrls: extractEpgUrls(content),
  };
}

export async function loadIPTVPlaylist(): Promise<IPTVChannel[]> {
  const playlist = await loadIPTVPlaylistWithMeta();
  return playlist.channels;
}

export async function loadIPTVPlaylistWithMeta(): Promise<IPTVPlaylist> {
  const asset = Asset.fromModule(playlistAsset);
  await asset.downloadAsync();

  if (!asset.localUri) {
    throw new Error('تعذر الوصول إلى ملف IPTV');
  }

  const response = await fetch(asset.localUri);
  const content = await response.text();

  return parseIPTVPlaylistWithMeta(content);
}

export function parseIPTVPlaylist(
  content: string
): IPTVChannel[] {
  return parseIPTVPlaylistWithMeta(content).channels;
}

export function groupIPTVChannels(
  channels: IPTVChannel[]
): IPTVGroup[] {
  const groups = new Map<string, IPTVChannel[]>();

  for (const channel of channels) {
    const groupName = channel.group || 'غير مصنف';

    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }

    groups.get(groupName)!.push(channel);
  }

  return Array.from(groups.entries()).map(([name, channels]) => ({
    name,
    channels,
  }));
}
