import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Modal, Platform } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

interface Channel {
  id: string;
  name: string;
  category: string;
}

interface YacineNativeProps {
  onClose: () => void;
}

export default function YacineNative({ onClose }: YacineNativeProps) {
  const [channels, setChannels] = useState<Channel[]>([]);

  const staticChannels: Channel[] = [
    { id: "1", name: "🎬 MBC 2 HD (أفلام هوليوود)", category: "أفلام وترفيه" },
    { id: "2", name: "🎬 MBC Action HD (حركة ومصارعة)", category: "أفلام وترفيه" },
    { id: "3", name: "🎬 MBC Max HD (أفلام منوعة)", category: "أفلام وترفيه" },
    { id: "4", name: "🎬 روتانا سينما (أفلام عربية)", category: "أفلام وترفيه" },
    { id: "5", name: "🦁 ناشيونال جيوغرافيك أبوظبي HD", category: "وثائقيات" },
    { id: "6", name: "🌍 الجزيرة الوثائقية HD", category: "وثائقيات" },
    { id: "7", name: "⚽ قناة الكأس الرياضية One HD", category: "رياضة مفتوحة" },
    { id: "8", name: "⚽ أبوظبي الرياضية 1 HD", category: "رياضة مفتوحة" }
  ];

  useEffect(() => {
    setChannels(staticChannels);
    // قفل اتجاه الشاشة فوراً على الوضع الطولي المستقر ومنع أي دوران عرضي
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
    
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
    };
  }, []);

  const handleClosePlayer = async () => {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
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

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>دليل البث والترددات الفعالة للشرق الأوسط</Text>
        </View>

        <FlatList
          data={channels}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <View style={styles.channelInfo}>
                <Text style={styles.categoryBadge}>{item.category}</Text>
                <Text style={styles.name}>{item.name}</Text>
              </View>
              <Text style={styles.playIcon}>🌐</Text>
            </View>
          )}
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
  infoBox: { backgroundColor: '#161f30', padding: 15, margin: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#232e42' },
  infoText: { color: '#8a94a6', fontSize: 13, fontWeight: '500' },
  listContainer: { paddingVertical: 5 },
  item: { flexDirection: 'row', backgroundColor: '#161f30', padding: 16, marginVertical: 5, marginHorizontal: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#232e42' },
  channelInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  categoryBadge: { fontSize: 10, color: '#ff1e27', backgroundColor: '#2d1a22', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 12, overflow: 'hidden', marginRight: 10, fontWeight: 'bold', textAlign: 'center', minWidth: 80 },
  name: { fontSize: 14, color: '#fff', fontWeight: '600', textAlign: 'left', flex: 1 },
  playIcon: { fontSize: 14, color: '#4a5568' }
});
