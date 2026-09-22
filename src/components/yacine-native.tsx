import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, Modal, Platform, Linking, Alert } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';

interface Channel {
  id: string;
  name: string;
  url: string;
  isCustomPlayer?: boolean;
}

interface YacineNativeProps {
  onClose: () => void;
}

export default function YacineNative({ onClose }: YacineNativeProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [loadingChannels, setLoadingChannels] = useState<boolean>(true);
  const [loadingVideo, setLoadingVideo] = useState<boolean>(false);

  // روابط قنوات حية ومفتوحة 100% لعام 2026 + تصحيح روابط تشغيل مشغل YTV PRO
  const officialChannels: Channel[] = [
    {
      id: "1",
      name: "📺 الجزيرة الإخبارية HD (مفتوحة - داخل التطبيق)",
      url: "https://akamaized.net"
    },
    {
      id: "2",
      name: "📺 قناة الكأس المفتوحة HD (داخل التطبيق)",
      url: "https://alkass.net"
    },
    {
      id: "3",
      name: "⚽ BEIN SPORT 1 HD (مشفرة - فتح مباشر YTV PRO)",
      url: "https://hdmn.io",
      isCustomPlayer: true
    },
    {
      id: "4",
      name: "⚽ BEIN SPORT 2 HD (مشفرة - فتح مباشر YTV PRO)",
      url: "https://hdmn.io",
      isCustomPlayer: true
    }
  ];

  useEffect(() => {
    setChannels(officialChannels);
    setCurrentUrl(officialChannels[0].url);
    setLoadingChannels(false);

    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
    };
  }, []);

  const player = useVideoPlayer(
    {
      uri: currentUrl || 'https://',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
      },
    },
    (playerInstance) => {
      playerInstance.loop = false;
      if (currentUrl) playerInstance.play();
    }
  );

  const handleSelectChannel = async (channel: Channel) => {
    if (channel.isCustomPlayer) {
      // 🔗 استخدام الـ Scheme الرسمي المباشر لتشغيل تطبيق YTV PRO فوراً وتخطي المتصفحات
      const ytvProSchema = `ytv://play?url=${encodeURIComponent(channel.url)}`;
      
      Linking.canOpenURL(ytvProSchema).then((supported) => {
        if (supported) {
          Linking.openURL(ytvProSchema);
        } else {
          // خطة احتياطية عبر استخدام الـ Android Intent الرسمي للمشغل لتشغيله إجبارياً
          const intentUrl = `intent:${channel.url}#Intent;package=com.ytv.player.pro;scheme=http;end`;
          Linking.openURL(intentUrl).catch(() => {
            Alert.alert("تنبيه المشغل", "تأكد من تثبيت تطبيق YTV Player Pro على هاتفك لتشغيل القنوات المشفّرة.");
          });
        }
      });
      return;
    }

    setLoadingVideo(true);
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    setCurrentUrl(channel.url);
    
    player.replace({
      uri: channel.url,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
      },
    });
    setTimeout(() => setLoadingVideo(false), 500);
  };

  const handleClosePlayer = async () => {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
    onClose();
  };

  return (
    <Modal animationType="slide" transparent={false} visible={true} onRequestClose={handleClosePlayer}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>قنوات البث المباشر</Text>
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
              <TouchableOpacity
                style={[styles.item, isSelected && styles.activeItem]}
                onPress={() => handleSelectChannel(item)}
              >
                <View style={styles.channelInfo}>
                  <Text style={styles.icon}>{item.isCustomPlayer ? "🔒" : "🔓"}</Text>
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
  container: { flex: 1, backgroundColor: '#0b1220' }, 
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#161f30', alignItems: 'center', borderBottomWidth: 1, borderColor: '#232e42' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  closeBtn: { backgroundColor: '#ff1e27', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 6 },
  closeText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  videoContainer: { width: '100%', height: 220, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  video: { width: '100%', height: '100%' },
  listContainer: { paddingVertical: 10 },
  item: { flexDirection: 'row', backgroundColor: '#161f30', padding: 16, marginVertical: 5, marginHorizontal: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#232e42' },
  activeItem: { borderColor: '#ff1e27', backgroundColor: '#1f1924' },
  channelInfo: { flexDirection: 'row', alignItems: 'center' },
  icon: { fontSize: 16, marginRight: 12 },
  name: { fontSize: 14, color: '#fff', fontWeight: '600', textAlign: 'left' },
  playIcon: { fontSize: 14, color: '#4a5568' },
  activePlayIcon: { color: '#ff1e27' }
});
