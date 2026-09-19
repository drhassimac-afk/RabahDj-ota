import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Image } from 'react-native';

export type NativeFileEntry = {
  id: string;
  name: string;
  size: number;
  dataUrl: string;
  from: string;
  mine: boolean;
};

type Props = {
  files: NativeFileEntry[];
  onPickFile: () => void;
  onDownload: (file: NativeFileEntry) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilesNative({ files, onPickFile, onDownload, onDelete, onBack }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <TouchableOpacity style={styles.back} onPress={onBack}>
          <Text style={styles.backText}>← رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.title}>مشاركة ملفات</Text>
        <View style={{ width: 70 }} />
      </View>

      <TouchableOpacity style={styles.pickBtn} onPress={onPickFile}>
        <Text style={styles.pickBtnText}>اختر ملف أو أكثر للمشاركة</Text>
      </TouchableOpacity>

      <FlatList
        data={files}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={{ paddingBottom: 30 }}
        renderItem={({ item }) => {
          const isImage = item.dataUrl.startsWith('data:image/');
          return (
            <View style={styles.fileRow}>
              {isImage ? (
                <Image source={{ uri: item.dataUrl }} style={styles.thumb} />
              ) : (
                <View style={styles.thumbFallback}>
                  <Text style={{ fontSize: 20 }}>📄</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.fileName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.fileMeta}>
                  {item.mine ? 'أرسلته أنت' : `من ${item.from}`} · {formatSize(item.size)}
                </Text>
              </View>
              <TouchableOpacity style={styles.downloadBtn} onPress={() => onDownload(item)}>
                <Text style={styles.downloadText}>تحميل</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(item.id)}>
                <Text style={styles.deleteText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📁</Text>
            <Text style={styles.emptyTitle}>لا توجد ملفات بعد</Text>
            <Text style={styles.emptySubtitle}>
              اختر ملفًا أو أكثر لمشاركته مع الموجودين في الغرفة
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220', paddingTop: 50, paddingHorizontal: 16 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  back: { backgroundColor: '#ffffff14', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12 },
  backText: { color: '#fff', fontWeight: '700' },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  pickBtn: { backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  pickBtnText: { color: '#fff', fontWeight: '800' },
  list: { flex: 1 },
  fileRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff0a',
    borderWidth: 1, borderColor: '#ffffff14', borderRadius: 14, padding: 12, marginBottom: 10, gap: 10,
  },
  thumb: { width: 48, height: 48, borderRadius: 10 },
  thumbFallback: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#ffffff14', justifyContent: 'center', alignItems: 'center' },
  fileName: { color: '#fff', fontWeight: '700' },
  fileMeta: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  downloadBtn: { backgroundColor: '#2563eb', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  downloadText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  deleteBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(220,38,38,0.12)', alignItems: 'center', justifyContent: 'center' },
  deleteText: { fontSize: 14 },
  emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 42, marginBottom: 12, opacity: 0.45 },
  emptyTitle: { color: '#cbd5e1', fontSize: 15, fontWeight: '800', marginBottom: 6 },
  emptySubtitle: { color: '#64748b', fontSize: 12, textAlign: 'center', lineHeight: 19 },
});
