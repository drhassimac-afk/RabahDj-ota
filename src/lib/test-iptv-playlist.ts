import { loadIPTVPlaylist } from './iptv-playlist';

loadIPTVPlaylist()
  .then((channels) => {
    console.log('IPTV PLAYLIST TEST OK');
    console.log('IPTV القنوات:', channels.length);
    console.log('IPTV أول قناة:', channels[0]?.name);
    console.log('IPTV أول مجموعة:', channels[0]?.group);
  })
  .catch((error) => {
    console.error('IPTV PLAYLIST TEST ERROR:', error);
  });
