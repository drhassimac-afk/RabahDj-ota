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

  const fetchLiveAutoChannels = async () => {
    try {
      setLoadingChannels(true);
      const m3uUrl = "https://githubusercontent.com";
      const response = await fetch(m3uUrl);
      const text = await response.text();
      
      const lines = text.split("\n");
      const fetchedChannels: Channel[] = [];
      let currentName = "";
      let channelId = 1;

      for (let line of lines) {
        line = line.trim();
        if (line.startsWith("#EXTINF")) {
          const match = line.match(/,(.+)\$/);
          if (match && match[1]) {
            currentName = match[1].trim();
          }
        } else if (line.startsWith("http") && currentName) {
          const upperName = currentName.toUpperCase();
          if (
            upperName.includes("BEIN") || 
            upperName.includes("SPORT") || 
            upperName.includes("KASS") || 
            upperName.includes("SSC") || 
            upperName.includes("MBC")
          ) {
            fetchedChannels.push({
              id: String(channelId),
              name: currentName,
              url: line
            });
            channelId++;
          }
          currentName = "";
        }
      }

      // إضافة باقة القنوات الأساسية المفتوحة والمشفرة لتعمل في حال بطء السيرفر العالمي
      const baseChannels: Channel[] = [
        { id: "991", name: "📺 بي إن سبورت الإخبارية (مفتوحة داخلياً)", url: "https://akamaized.net" },
        { id: "992", name: "📺 قناة الكأس المفتوحة HD (داخلياً)", url: "https://alkass.net" },
        { id: "993", name: "📺 الجزيرة الإخبارية HD (داخلياً)", url: "https://akamaized.net" },
        { id: "994", name: "🔒 BEIN SPORT 1 HD (عبر مشغل YTV PRO)", url: "https://hdmn.io", isCustomPlayer: true }
      ];

      const finalSplit = [...baseChannels, ...fetchedChannels];
      setChannels(finalSplit);
      setCurrentUrl(finalSplit[0].url);
    } catch (error) {
      console.error("Error auto-fetching channels:", error);
    } finally {
      setLoadingChannels(false);
    }
  };

  useEffect(() => {
    fetchLiveAutoChannels();
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
    if (channel.isCustomPlayer) {
      const ytvIntentUrl = `intent:${channel.url}#Intent;package=com.ytv.player.pro;scheme=http;end`;
      Linking.canOpenURL(ytvIntentUrl).then((supported) => {
        if (supported) { Linking.openURL(ytvIntentUrl); }
        else { Alert.alert("YTV Player PRO", "يرجى تثبيت مشغل ياسين تيفي لتشغيل هذه القناة المشفرة."); }
      });
      return;
    }

    setLoadingVideo(true);
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    setCurrentUrl(channel.url);
    player.replace({ uri: channel.url, headers: { 'User-Agent': 'Mozilla/5.0' } });
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
          <Text style={styles.headerTitle}>قنوات البث المباشر الفعالة</Text>
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

        {loadingChannels ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#ff1e27" />
            <Text style={styles.loadingText}>جاري ترتيب قائمة القنوات الرياضية الحية...</Text>
          </View>
        ) : (
          <FlatList
            data={channels}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item }) => {
              const isSelected = currentUrl === item.url;
              return (
                <TouchableOpacity style={[styles.item, isSelected && styles.activeItem]} onPress={() => handleSelectChannel(item)}>
                  <View style={styles.channelInfo}>
                    <Text style={styles.icon}>{item.isCustomPlayer ? "🔒" : "⚽"}</Text>
                    <Text style={styles.name}>{item.name}</Text>
                  </View>
                  <Text style={[styles.playIcon, isSelected && styles.activePlayIcon]}>▶</Text>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220' }, 
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { color: '#8a94a6', marginTop: 15, fontSize: 13, fontWeight: '500' },
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
