import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

interface Channel {
  id: string;
  name: string;
  url: string;
}

interface YacineNativeProps {
  onClose: () => void;
}

export default function YacineNative({ onClose }: YacineNativeProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [loadingChannels, setLoadingChannels] = useState<boolean>(true);
  const [loadingVideo, setLoadingVideo] = useState<boolean>(false);

  // 🔗 رابط ملف الـ Gist الخاص بك (استبدل XXXXXX برابطك الحقيقي لاحقاً إن أردت)
  const jsonUrl = 'https://githubusercontent.com';

  const fetchChannels = async () => {
    try {
      const response = await fetch(jsonUrl);
      const data: Channel[] = await response.json();
      setChannels(data);
      if (data.length > 0) setCurrentUrl(data[0].url);
    } catch (error) {
      console.error("Error fetching Yacine TV channels:", error);
    } finally {
      setLoadingChannels(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const player = useVideoPlayer(
    {
      uri: currentUrl || 'https://',
      headers: {
        'User-Agent': 'Yacine TV/3.0 (Android; Mobile)',
        'Referer': 'http://yacine-tv.net',
        'Host': '104.26.0.214',
      },
    },
    (playerInstance) => {
      playerInstance.loop = false;
      if (currentUrl) playerInstance.play();
    }
  );

  const handleSelectChannel = (url: string) => {
    setLoadingVideo(true);
    setCurrentUrl(url);
    player.replace({
      uri: url,
      headers: {
        'User-Agent': 'Yacine TV/3.0 (Android; Mobile)',
        'Referer': 'http://yacine-tv.net',
        'Host': '104.26.0.214',
      },
    });
    setTimeout(() => setLoadingVideo(false), 500);
  };

  if (loadingChannels) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ff0000" />
        <Text style={{ marginTop: 10 }}>جاري تحميل قنوات Yacine TV...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Yacine TV المباشر</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>إغلاق</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.videoContainer}>
        {loadingVideo || !currentUrl ? (
          <ActivityIndicator size="large" color="#ff0000" />
        ) : (
          <VideoView player={player} style={styles.video} allowsFullscreen allowsPictureInPicture />
        )}
      </View>

      <FlatList
        data={channels}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.item, currentUrl === item.url && styles.activeItem]}
            onPress={() => handleSelectChannel(item.url)}
          >
            <Text style={styles.icon}>📺</Text>
            <Text style={styles.name}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, backgroundColor: '#ff0000', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  closeBtn: { backgroundColor: '#fff', padding: 5, borderRadius: 5, paddingHorizontal: 10 },
  closeText: { color: '#ff0000', fontWeight: 'bold' },
  videoContainer: { width: '100%', height: 210, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  video: { width: '100%', height: '100%' },
  item: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, marginVertical: 4, marginHorizontal: 10, borderRadius: 8, alignItems: 'center' },
  activeItem: { borderColor: '#ff0000', borderWidth: 1, backgroundColor: '#ffe6e6' },
  icon: { fontSize: 18, marginRight: 10 },
  name: { fontSize: 16, color: '#333', textAlign: 'left', flex: 1 }
});
