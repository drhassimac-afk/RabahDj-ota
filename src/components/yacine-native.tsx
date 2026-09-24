import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, Modal, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import * as ScreenOrientation from 'expo-screen-orientation';

interface Channel {
  id: string;
  name: string;
  channelId: string;
  category: string;
}

interface YacineNativeProps {
  onClose: () => void;
}

// نفس القنوات الرسمية المجانية المتحقق منها فعلياً في cinema-native.tsx (Channel ID حقيقي لكل واحدة)
const officialLiveChannels: Channel[] = [
  { id: '1', name: '📡 الجزيرة مباشر', channelId: 'UCCv1Pd24oPErw5S7zJWltnQ', category: 'أخبار' },
  { id: '2', name: '🇫🇷 فرانس 24 عربية', channelId: 'UCdTyuXgmJkG_O8_75eqej-w', category: 'أخبار' },
  { id: '3', name: '🇬🇧 بي بي سي عربي', channelId: 'UCelk6aHijZq-GJBBB9YpReA', category: 'أخبار' },
  { id: '4', name: '📰 سكاي نيوز عربية', channelId: 'UCIJXOvggjKtCagMfxvcCzAA', category: 'أخبار' },
  { id: '5', name: '🗞️ الحدث', channelId: 'UCrj5BGAhtWxDfqbza9T9hqA', category: 'أخبار' },
  { id: '6', name: '🌍 يورونيوز', channelId: 'UCW2QcKZiU8aUGg4yxCIditg', category: 'أخبار' },
  { id: '7', name: '🎙️ دي دبليو عربي', channelId: 'UC30ditU5JI16o5NbFsHde_Q', category: 'أخبار' },
  { id: '8', name: '🇩🇿 الجزائر الدولية', channelId: 'UC2TJu-b6OCHIxW-TvoF5NSQ', category: 'أخبار' },
  { id: '9', name: '⚽ بين سبورت نيوز', channelId: 'UCJUCcJUeh0Cz2xyKwkw5Q1w', category: 'رياضة' },
];

// صفحة HTML صغيرة تحتوي iframe يوتيوب (نفس تقنية html-host.tsx التي تعمل بالفعل)
function buildEmbedHtml(channelId: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    * { margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
    iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; }
  </style>
</head>
<body>
  <iframe
    src="https://www.youtube.com/embed/live_stream?channel=${channelId}&autoplay=1&playsinline=1&modestbranding=1&rel=0"
    allow="autoplay; encrypted-media; picture-in-picture"
    allowfullscreen
  ></iframe>
</body>
</html>`;
}

export default function YacineNative({ onClose }: YacineNativeProps) {
  const [channels] = useState<Channel[]>(officialLiveChannels);
  const [currentChannel, setCurrentChannel] = useState<Channel>(officialLiveChannels[0]);
  const [loadingVideo, setLoadingVideo] = useState<boolean>(true);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
    };
  }, []);

  const handleSelectChannel = (channel: Channel) => {
    if (channel.channelId === currentChannel.channelId) return;
    setLoadingVideo(true);
    setCurrentChannel(channel);
  };

  const handleClosePlayer = () => {
    onClose();
  };

  return (
    <Modal animationType="slide" transparent={false} visible={true} onRequestClose={handleClosePlayer}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📺 قنوات المباشرة Rabah</Text>
          <TouchableOpacity onPress={handleClosePlayer} style={styles.closeBtn}>
            <Text style={styles.closeText}>رجوع ←</Text>
          </TouchableOpacity>
        </View>

        {/* مشغل الفيديو عبر WebView + iframe (نفس تقنية html-host.tsx) */}
        <View style={styles.videoContainer}>
          <WebView
            key={currentChannel.channelId}
            source={{ html: buildEmbedHtml(currentChannel.channelId), baseUrl: 'https://www.youtube.com' }}
            style={styles.video}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            allowsFullscreenVideo
            mediaPlaybackRequiresUserAction={false}
            mixedContentMode="always"
            originWhitelist={['*']}
            onLoadEnd={() => setLoadingVideo(false)}
            onError={(e) => console.log('yacine webview error', e.nativeEvent)}
            onHttpError={(e) => console.log('yacine webview http error', e.nativeEvent)}
          />
          {loadingVideo && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#ff1e27" />
            </View>
          )}
        </View>

        {/* قائمة القنوات */}
        <FlatList
          data={channels}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => {
            const isSelected = currentChannel.channelId === item.channelId;
            return (
              <TouchableOpacity
                style={[styles.item, isSelected && styles.activeItem]}
                onPress={() => handleSelectChannel(item)}
              >
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
  video: { width: '100%', height: '100%', backgroundColor: '#000' },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  listContainer: { paddingVertical: 10 },
  item: { flexDirection: 'row', backgroundColor: '#161f30', padding: 16, marginVertical: 5, marginHorizontal: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#232e42' },
  activeItem: { borderColor: '#ff1e27', backgroundColor: '#1f1924' },
  channelInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  categoryBadge: { fontSize: 10, color: '#ff1e27', backgroundColor: '#2d1a22', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 12, overflow: 'hidden', marginRight: 10, fontWeight: 'bold', textAlign: 'center', minWidth: 80 },
  name: { fontSize: 14, color: '#fff', fontWeight: '600', textAlign: 'left', flex: 1 },
  playIcon: { fontSize: 14, color: '#4a5568' },
  activePlayIcon: { color: '#ff1e27' },
});
