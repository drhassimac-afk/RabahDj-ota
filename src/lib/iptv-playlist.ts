import { Asset } from 'expo-asset';
import parser from 'iptv-playlist-parser';

export interface IPTVChannel {
  name: string;
  url: string;
  group: string;
  tvgId: string;
  logo: string;
}

export interface IPTVGroup {
  name: string;
  channels: IPTVChannel[];
}

const playlistAsset = require('../../assets/iptv/playlist.m3u');

export async function loadIPTVPlaylist(): Promise<IPTVChannel[]> {
  const asset = Asset.fromModule(playlistAsset);

  await asset.downloadAsync();

  if (!asset.localUri) {
    throw new Error('تعذر الوصول إلى ملف IPTV');
  }

  const response = await fetch(asset.localUri);
  const content = await response.text();

  return parseIPTVPlaylist(content);
}

export function parseIPTVPlaylist(content: string): IPTVChannel[] {
  const result = parser.parse(content);

  return result.items.map((item) => ({
    name: item.name || 'بدون اسم',
    url: item.url || '',
    group: item.group?.title || 'غير مصنف',
    tvgId: item.tvg?.id || '',
    logo: item.tvg?.logo || '',
  }));
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
