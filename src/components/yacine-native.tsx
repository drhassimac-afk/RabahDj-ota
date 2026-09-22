import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
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

  const jsonUrl = 'https://githubusercontent.com';

  const fetchChannels = async () => {
    try {
      const response = await fetch(jsonUrl);
      const data: Channel[] = await response.json();
      setChannels(data);
      
      if (data.length > 0) {
        const firstChannel = data[0];
        if (firstChannel.qualities && firstChannel.qualities.length > 0) {
          setCurrentQualities(firstChannel.qualities);
          setCurrentUrl(firstChannel.qualities[0].url);
          setActiveQuality(firstChannel.qualities[0].label);
        } else {
          setCurrentUrl(firstChannel.url);
        }
      }
    } catch (error) {
      console.error("Error fetching Yacine TV channels:", error);
    } finally {
      setLoadingChannels(false);
    }
  };

  useEffect(() => {
    fetchChannels();
    // عند الخروج من المكون، يتم إرجاع الشاشة للوضع الطولي الافتراضي تلقائياً
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
    };
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

  // دالة اختيار القناة وتدوير الشاشة تلقائياً للعرض بالعرض للمباراة
  const handleSelectChannel = async (channel: Channel) => {
    setLoadingVideo(true);
    // تدوير الشاشة لوضع ملء الشاشة العرضي (Landscape)
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
        'User-Agent': 'Yacine TV/3.0 (Android; Mobile)',
        'Referer': 'http://yacine-tv.net',
        'Host': '104.26.0.214',
      },
    });
    setTimeout(() => setLoadingVideo(false), 500);
  };

  // دالة التعامل مع الإغلاق للرجوع للوضع الطولي
  const handleClosePlayer = async () => {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
    onClose();
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
        <TouchableOpacity onPress={handleClosePlayer} style={styles.closeBtn}>
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

      {currentQualities.length > 0 && (
        <View style={styles.qualityContainer}>
          <Text style={styles.qualityTitle}>اختر الجودة: </Text>
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
        renderItem={({ item }) => {
          const isSelected = currentQualities.length > 0 
            ? currentQualities[0].url === item.qualities?.[0].url
            : currentUrl === item.url;
            
          return (
            <TouchableOpacity
              style={[styles.item, isSelected && styles.activeItem]}
              onPress={() => handleSelectChannel(item)}
            >
              <Text style={styles.icon}>📺</Text>
              <Text style={styles.name}>{item.name}</Text>
            </TouchableOpacity>
          );
        }}
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
  qualityContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 10, borderBottomWidth: 1, borderColor: '#eee' },
  qualityTitle: { fontSize: 14, fontWeight: 'bold', color: '#666', marginRight: 10 },
  qualityBtn: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 15, backgroundColor: '#f0f0f0', marginRight: 8 },
  activeQualityBtn: { backgroundColor: '#ff0000' },
  qualityBtnText: { color: '#333', fontSize: 12, fontWeight: '600' },
  activeQualityBtnText: { color: '#fff' },
  item: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, marginVertical: 4, marginHorizontal: 10, borderRadius: 8, alignItems: 'center' },
  activeItem: { borderColor: '#ff0000', borderWidth: 1, backgroundColor: '#ffe6e6' },
  icon: { fontSize: 18, marginRight: 10 },
  name: { fontSize: 16, color: '#333', textAlign: 'left', flex: 1 }
});
