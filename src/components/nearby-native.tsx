import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';

type Props = {
  names: string[];
  myName: string;
  onWave: (name: string) => void;
  onBack: () => void;
};

export default function NearbyNative({ names, myName, onWave, onBack }: Props) {
  const others = names.filter((n) => n !== myName);
  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <TouchableOpacity style={styles.back} onPress={onBack}>
          <Text style={styles.backText}>← رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.title}>قريبون مني</Text>
        <View style={{ width: 70 }} />
      </View>

      <Text style={styles.desc}>الأشخاص المتصلين معك حاليًا بنفس الغرفة</Text>

      <FlatList
        data={others}
        keyExtractor={(item, i) => `${item}_${i}`}
        contentContainerStyle={{ paddingBottom: 30 }}
        ListHeaderComponent={
          myName ? (
            <View style={styles.row}>
              <Text style={styles.name}>👤 {myName} (أنت)</Text>
              <Text style={styles.statusPill}>متصل</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.name}>👤 {item}</Text>
            <TouchableOpacity style={styles.waveBtn} onPress={() => onWave(item)}>
              <Text style={styles.waveBtnText}>👋 سلّم</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📍</Text>
            <Text style={styles.emptyTitle}>ما فيه أشخاص متصلين حاليًا</Text>
            <Text style={styles.emptySubtitle}>
              عندما ينضم أشخاص آخرون إلى الغرفة سيظهرون هنا
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220', paddingHorizontal: 16, paddingTop: 20 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  back: { backgroundColor: '#ffffff14', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12 },
  backText: { color: '#fff', fontWeight: '700' },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  desc: { color: '#94a3b8', marginBottom: 14 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#ffffff0a', borderWidth: 1, borderColor: '#ffffff14', borderRadius: 14, padding: 14, marginBottom: 10,
  },
  name: { color: '#fff', fontWeight: '700' },
  statusPill: { color: '#4ade80', backgroundColor: '#4ade8018', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, fontSize: 12 },
  waveBtn: { backgroundColor: '#2563eb', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  waveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  emptyState: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 42, marginBottom: 12, opacity: 0.45 },
  emptyTitle: { color: '#cbd5e1', fontSize: 15, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  emptySubtitle: { color: '#64748b', fontSize: 12, textAlign: 'center', lineHeight: 19 },
});
