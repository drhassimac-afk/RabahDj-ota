import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, FlatList } from 'react-native';
import * as Clipboard from 'expo-clipboard';

type Category = 'movies' | 'tv' | 'series';

const CATEGORY_META: Record<Category, { label: string; icon: string }> = {
  movies: { label: 'أفلام', icon: '🎬' },
  tv: { label: 'تلفاز', icon: '📺' },
  series: { label: 'مسلسلات', icon: '🍿' },
};

type Props = {
  category: Category;
  history: string[];
  onSelectCategory: (cat: Category) => void;
  onPlay: (url: string) => void;
  onDeleteHistoryItem: (url: string) => void;
  onBack: () => void;
};

function isLikelyValidUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return /^https?:\/\/.+/i.test(v);
}

function isYouTube(url: string): boolean {
  return /youtu\.?be/i.test(url);
}

type PresetChannel = { name: string; emoji: string; channelId: string | null };

const PRESET_CHANNELS: PresetChannel[] = [
  { name: 'الجزيرة مباشر', emoji: '📡', channelId: 'UCCv1Pd24oPErw5S7zJWltnQ' },
  { name: 'فرانس 24 عربية', emoji: '🇫🇷', channelId: null },
  { name: 'بي بي سي عربي', emoji: '🇬🇧', channelId: null },
  { name: 'سكاي نيوز عربية', emoji: '📰', channelId: null },
  { name: 'الحرة', emoji: '📻', channelId: null },
  { name: 'يورونيوز', emoji: '🌍', channelId: null },
  { name: 'دي دبليو عربي', emoji: '🎙️', channelId: null },
  { name: 'بين سبورت نيوز', emoji: '⚽', channelId: null },
];

export default function CinemaNative({
  category,
  history,
  onSelectCategory,
  onPlay,
  onDeleteHistoryItem,
  onBack,
}: Props) {
  const [url, setUrl] = useState('');
  const canPlay = useMemo(() => isLikelyValidUrl(url), [url]);

  const handlePlay = () => {
    if (!canPlay) return;
    onPlay(url.trim());
    setUrl('');
  };

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setUrl(text.trim());
  };

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <TouchableOpacity style={styles.back} onPress={onBack}>
          <Text style={styles.backText}>← رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.title}>سينما وتلفاز</Text>
        <View style={{ width: 70 }} />
      </View>

      <View style={styles.tabs}>
        {(Object.keys(CATEGORY_META) as Category[]).map((cat) => {
          const meta = CATEGORY_META[cat];
          const active = category === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => onSelectCategory(cat)}
              activeOpacity={0.85}
            >
              <Text style={styles.tabIcon}>{meta.icon}</Text>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{meta.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {category === 'tv' && (
        <View style={styles.presetSection}>
          <Text style={styles.presetLabel}>قنوات إخبارية مباشرة</Text>
          <View style={styles.presetGrid}>
            {PRESET_CHANNELS.map((ch) => {
              const ready = !!ch.channelId;
              return (
                <TouchableOpacity
                  key={ch.name}
                  style={[styles.presetBtn, !ready && styles.presetBtnDisabled]}
                  disabled={!ready}
                  onPress={() => ready && onPlay(`https://www.youtube.com/embed/live_stream?channel=${ch.channelId}`)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.presetEmoji}>{ch.emoji}</Text>
                  <Text style={styles.presetName} numberOfLines={1}>{ch.name}</Text>
                  {!ready && <Text style={styles.presetSoon}>قريبًا</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>شارك فيديو مع الجميع</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="رابط YouTube أو mp4"
            placeholderTextColor="#5b6785"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.pasteBtn} onPress={handlePaste} activeOpacity={0.8}>
            <Text style={styles.pasteBtnText}>📋</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.playBtn, !canPlay && styles.playBtnDisabled]}
          onPress={handlePlay}
          disabled={!canPlay}
          activeOpacity={0.85}
        >
          <Text style={styles.playBtnText}>{canPlay ? '▶ عرض للجميع' : 'الصق رابطًا صالحًا أولًا'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.historyHeader}>
        <Text style={styles.historyLabel}>
          {CATEGORY_META[category].icon} آخر روابط {CATEGORY_META[category].label}
        </Text>
        {history.length > 0 && <Text style={styles.historyCount}>{history.length}</Text>}
      </View>

      <FlatList
        data={history}
        keyExtractor={(item, i) => `${item}_${i}`}
        contentContainerStyle={history.length === 0 ? styles.emptyContainer : { paddingBottom: 30 }}
        renderItem={({ item }) => (
          <View style={styles.historyRow}>
            <Text style={styles.historyTypeIcon}>{isYouTube(item) ? '▶️' : '🎞️'}</Text>
            <Text style={styles.historyUrl} numberOfLines={1}>{item}</Text>
            <TouchableOpacity style={styles.historyPlayBtn} onPress={() => onPlay(item)} activeOpacity={0.8}>
              <Text style={styles.historyPlayText}>عرض</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.historyDeleteBtn}
              onPress={() => onDeleteHistoryItem(item)}
              activeOpacity={0.8}
            >
              <Text style={styles.historyDeleteText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{CATEGORY_META[category].icon}</Text>
            <Text style={styles.emptyTitle}>ما فيه روابط بعد</Text>
            <Text style={styles.emptySubtitle}>أي رابط تعرضه هنا يُحفظ تلقائيًا للرجوع له بسرعة</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220', paddingTop: 50, paddingHorizontal: 16 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  back: { backgroundColor: '#ffffff14', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12 },
  backText: { color: '#fff', fontWeight: '700' },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },

  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: {
    flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center', gap: 4,
  },
  tabActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  tabIcon: { fontSize: 18 },
  tabText: { color: '#94a3b8', fontWeight: '700', fontSize: 12 },
  tabTextActive: { color: '#fff' },

  card: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22, padding: 18, marginBottom: 20,
  },
  presetSection: { marginBottom: 18 },
  presetLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '700', marginBottom: 10 },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetBtn: {
    width: '31%', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 14, paddingVertical: 12, alignItems: 'center', gap: 4,
  },
  presetBtnDisabled: { opacity: 0.4 },
  presetEmoji: { fontSize: 20 },
  presetName: { color: '#e2e8f0', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  presetSoon: { color: '#64748b', fontSize: 9, marginTop: 2 },
  cardLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '700', marginBottom: 12 },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  input: {
    flex: 1, backgroundColor: '#0f172a', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 14, color: '#fff', textAlign: 'right',
  },
  pasteBtn: {
    width: 50, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  pasteBtnText: { fontSize: 18 },
  playBtn: { backgroundColor: '#16a34a', paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  playBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.06)' },
  playBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  historyHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
  historyLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '700' },
  historyCount: {
    color: '#94a3b8', fontSize: 11, fontWeight: '800', backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden',
  },

  historyRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 16, padding: 12, marginBottom: 8, gap: 10,
  },
  historyTypeIcon: { fontSize: 15 },
  historyUrl: { flex: 1, color: '#e2e8f0', fontSize: 13 },
  historyPlayBtn: { backgroundColor: '#2563eb', paddingVertical: 7, paddingHorizontal: 14, borderRadius: 10 },
  historyPlayText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  historyDeleteBtn: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(220,38,38,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  historyDeleteText: { fontSize: 14 },

  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 30 },
  emptyIcon: { fontSize: 42, marginBottom: 12, opacity: 0.35 },
  emptyTitle: { color: '#cbd5e1', fontSize: 15, fontWeight: '800', marginBottom: 6 },
  emptySubtitle: { color: '#64748b', fontSize: 12, textAlign: 'center', paddingHorizontal: 30 },
});
