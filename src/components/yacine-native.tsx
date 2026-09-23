import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, Modal, Platform } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';

interface Channel {
  id: string;
  name: string;
  url: string;
  category: string;
}

interface YacineNativeProps {
  onClose: () => void;
}

export default function YacineNative({ onClose }: YacineNativeProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [loadingVideo, setLoadingVideo] = useState<boolean>(false);

  const staticChannels: Channel[] = [
    { id: "1", name: "🎬 MBC 2 HD (أفلام هوليوود)", url: "https://vdo.id", category: "أفلام وترفيه" },
    { id: "2", name: "🎬 MBC Action HD (حركة ومصارعة)", url: "https://vdo.id", category: "أفلام وترفيه" },
    { id: "3", name: "🎬 MBC Max HD (أفلام منوعة)", url: "https://vdo.id", category: "أفلام وترفيه" },
    { id: "4", name: "🎬 روتانا سينما (أفلام عربية)", url: "https://chb.sc", category: "أفلام وترفيه" },
    { id: "5", name: "🦁 ناشيونال جيوغرافيك أبوظبي HD", url: "https://vdo.id", category: "وثائقيات" },
    { id: "6", name: "🌍 الجزيرة الوثائقية HD", url: "https://akamaized.net", category: "وثائقيات" },
    { id: "7", name: "⚽ قناة الكأس الرياضية One HD", url: "https://alkass.net", category: "رياضة مفتوحة" },
    { id: "8", name: "⚽ أبوظبي الرياضية 1 HD", url: "https://akamaized.net", category: "رياضة مفتوحة" },
    { id: "9", name: "⚽ دبي الرياضية HD", url: "https://akamaized.net", category: "رياضة مفتوحة" },
    { id: "10", name: "⚽ بي إن سبورت الإخبارية المفتوحة", url: "https://akamaized.net", category: "رياضة مفتوحة" }
  ];

  useEffect(() => {
    setChannels(staticChannels);
    setCurrentUrl(staticChannels[0].url);
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
    };
  }, []);

  const player = useVideoPlayer(
    {
      uri: currentUrl || 'https://',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    },
    (playerInstance) => {
      playerInstance.loop = false;
      if (currentUrl) playerInstance.play();
    }
  );

  const handleSelectChannel = async (channel: Channel) => {
    setLoadingVideo(true);
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    setCurrentUrl(channel.url);
    player.replace({ uri: channel.url, headers: { 'User-Agent': 'Mozilla/5.0' } });
    setTimeout(() => setLoadingVideo(false), 400);
  };

  const handleClosePlayer = async () => {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
    onClose();
  };

  return (
    <Modal animationType="slide" transparent={false} visible={true} onRequestClose={handleClosePlayer}>
      <View style={styles.container}>
        {/* تغيير اسم اللافتة هنا لتكون احترافية وباسمك المخصص */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📺 RabahDj تيفي المباشر</Text>
          <TouchableOpacity onPress={handleClosePlayer} style={styles.closeBtn}>
            <Text style={styles.closeText}>رجوع ←</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.videoContainer}>
          {loadingVideo || !currentUrl ? (
            <ActivityIndicator size="large" color="#ff1e27" />
          ) : (
            <VideoView player={player} style={styles.video} allowsFullscreen allowsPictureInPicture />
          )}
        </View>

        <FlatList
          data={channels}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => {
            const isSelected = currentUrl === item.url;
            return (
              <TouchableOpacity style={[styles.item, isSelected && styles.activeItem]} onPress={() => handleSelectChannel(item)}>
                <View style={styles.channelInfo}>
                  <Text style={styles.categoryBadge}>{item.category}</Text>
                  <Text style={styles.name}>{item.name}</Text>
                </View>
                <Text style={[styles.playIcon, isSelected && styles.activePlayIcon]}>▶</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220', paddingTop: Platform.OS === 'ios' ? 40 : 0 }, 
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#161f30', alignItems: 'center', borderBottomWidth: 1, borderColor: '#232e42' },
  headerTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  closeBtn: { backgroundColor: '#ff1e27', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 6 },
  closeText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  videoContainer: { width: '100%', height: 220, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  video: { width: '100%', height: '100%' },
  listContainer: { paddingVertical: 10 },
  item: { flexDirection: 'row', backgroundColor: '#161f30', padding: 16, marginVertical: 5, marginHorizontal: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#232e42' },
  activeItem: { borderColor: '#ff1e27', backgroundColor: '#1f1924' },
  channelInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  categoryBadge: { fontSize: 10, color: '#ff1e27', backgroundColor: '#2d1a22', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 12, overflow: 'hidden', marginRight: 10, fontWeight: 'bold', textAlign: 'center', minWidth: 80 },
  name: { fontSize: 14, color: '#fff', fontWeight: '600', textAlign: 'left', flex: 1 },
  playIcon: { fontSize: 14, color: '#4a5568' },
  activePlayIcon: { color: '#ff1e27' }
});
