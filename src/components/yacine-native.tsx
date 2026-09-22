import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, Modal, Platform } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';

interface Channel {
  id: string;
  name: string;
  url: string;
  qualities?: { label: string; url: string }[];
}

interface YacineNativeProps {
  onClose: () => void;
}

export default function YacineNative({ onClose }: YacineNativeProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [currentQualities, setCurrentQualities] = useState<{ label: string; url: string }[]>([]);
  const [activeQuality, setActiveQuality] = useState<string>('');
  const [loadingChannels, setLoadingChannels] = useState<boolean>(true);
  const [loadingVideo, setLoadingVideo] = useState<boolean>(false);

  // سيرفرات بث حية مخصصة ومباشرة مدمجة لتعمل فوراً وتظهر قائمة القنوات دون انتظار الإنترنت
  const fallbackChannels: Channel[] = [
    {
      id: "1",
      name: "BEIN SPORT 1 HD",
      qualities: [
        { label: "جودة عالية HD", url: "https://hdmn.io" }
      ]
    },
    {
      id: "2",
      name: "BEIN SPORT 2 HD",
      qualities: [
        { label: "جودة عالية HD", url: "https://hdmn.io" }
      ]
    },
    {
      id: "3",
      name: "SSC SPORT 1 HD (الدوري السعودي)",
      qualities: [
        { label: "بث فوري", url: "https://longtailvideo.com" }
      ]
    },
    {
      id: "4",
      name: "قناة الكأس الرياضية",
      qualities: [
        { label: "بث فوري", url: "https://vodobox.net" }
      ]
    }
  ];

  useEffect(() => {
    // تشغيل القنوات مباشرة دون انتظار اللودنج اللانهائي
    setChannels(fallbackChannels);
    const firstChannel = fallbackChannels[0];
    if (firstChannel && firstChannel.qualities && firstChannel.qualities.length > 0) {
      setCurrentQualities(firstChannel.qualities);
      setCurrentUrl(firstChannel.qualities[0].url);
      setActiveQuality(firstChannel.qualities[0].label);
    }
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
        'Referer': 'http://yacine-tv.net',
      },
    },
    (playerInstance) => {
      playerInstance.loop = false;
      if (currentUrl) playerInstance.play();
    }
  );

  const handleSelectChannel = async (channel: Channel) => {
    setLoadingVideo(true);
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);

    if (channel.qualities && channel.qualities.length > 0) {
      setCurrentQualities(channel.qualities);
      changeQuality(channel.qualities[0].url, channel.qualities[0].label);
    } else {
      setCurrentQualities([]);
      changeQuality(channel.url, '');
    }
  };

  const changeQuality = (url: string, label: string) => {
    setCurrentUrl(url);
    setActiveQuality(label);
    player.replace({
      uri: url,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
        'Referer': 'http://yacine-tv.net',
      },
    });
    setTimeout(() => setLoadingVideo(false), 500);
  };

  const handleClosePlayer = async () => {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={true}
      onRequestClose={handleClosePlayer}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>قنوات ياسين تيفي المباشرة</Text>
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

        {currentQualities.length > 0 && (
          <View style={styles.qualityContainer}>
            <Text style={styles.qualityTitle}>الجودة:</Text>
            {currentQualities.map((q) => (
              <TouchableOpacity
                key={q.label}
                style={[styles.qualityBtn, activeQuality === q.label && styles.activeQualityBtn]}
                onPress={() => {
                  setLoadingVideo(true);
                  changeQuality(q.url, q.label);
                }}
              >
                <Text style={[styles.qualityBtnText, activeQuality === q.label && styles.activeQualityBtnText]}>
                  {q.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <FlatList
          data={channels}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => {
            const isSelected = currentQualities.length > 0 
              ? currentQualities[0].url === item.qualities?.[0].url
              : currentUrl === item.url;
              
            return (
              <TouchableOpacity
                style={[styles.item, isSelected && styles.activeItem]}
                onPress={() => handleSelectChannel(item)}
              >
                <View style={styles.channelInfo}>
                  <Text style={styles.icon}>⚽</Text>
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
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  closeBtn: { backgroundColor: '#ff1e27', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 6 },
  closeText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  videoContainer: { width: '100%', height: 220, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  video: { width: '100%', height: '100%' },
  qualityContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161f30', padding: 12, borderBottomWidth: 1, borderColor: '#232e42' },
  qualityTitle: { fontSize: 13, fontWeight: 'bold', color: '#8a94a6', marginRight: 10 },
  qualityBtn: { paddingVertical: 5, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#232e42', marginRight: 8 },
  activeQualityBtn: { backgroundColor: '#ff1e27' },
  qualityBtnText: { color: '#a0aec0', fontSize: 12, fontWeight: 'bold' },
  activeQualityBtnText: { color: '#fff' },
  listContainer: { paddingVertical: 10 },
  item: { flexDirection: 'row', backgroundColor: '#161f30', padding: 16, marginVertical: 5, marginHorizontal: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#232e42' },
  activeItem: { borderColor: '#ff1e27', backgroundColor: '#1f1924' },
  channelInfo: { flexDirection: 'row', alignItems: 'center' },
  icon: { fontSize: 18, marginRight: 12 },
  name: { fontSize: 15, color: '#fff', fontWeight: '600', textAlign: 'left', marginRight: 10 },
  playIcon: { fontSize: 14, color: '#4a5568' },
  activePlayIcon: { color: '#ff1e27' }
});
