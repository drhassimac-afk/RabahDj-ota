import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, FlatList } from 'react-native';

export type ChatMessage = { id: string; name: string; text: string; mine: boolean };

type Props = {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onBack: () => void;
};

export default function ChatNative({ messages, onSend, onBack }: Props) {
  const [text, setText] = useState('');
  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <TouchableOpacity style={styles.back} onPress={onBack}>
          <Text style={styles.backText}>← رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.title}>محادثات فورية</Text>
        <View style={{ width: 70 }} />
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={{ paddingBottom: 10 }}
        renderItem={({ item }) => (
          <View style={[styles.msg, item.mine && styles.msgMine]}>
            <Text style={styles.msgName}>{item.name}</Text>
            <Text style={styles.msgText}>{item.text}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>لا توجد رسائل بعد</Text>
            <Text style={styles.emptySubtitle}>
              ابدأ المحادثة برسالة جديدة وسيظهر الحوار هنا
            </Text>
          </View>
        }
      />

      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="اكتب رسالة..."
          placeholderTextColor="#64748b"
          value={text}
          onChangeText={setText}
        />
        <TouchableOpacity
          style={styles.sendBtn}
          onPress={() => {
            if (!text.trim()) return;
            onSend(text.trim());
            setText('');
          }}
        >
          <Text style={styles.sendBtnText}>إرسال</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220', paddingHorizontal: 16, paddingTop: 20 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  back: { backgroundColor: '#ffffff14', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12 },
  backText: { color: '#fff', fontWeight: '700' },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  list: { flex: 1 },
  msg: { backgroundColor: '#ffffff12', padding: 10, borderRadius: 14, maxWidth: '85%', alignSelf: 'flex-start', marginBottom: 8 },
  msgMine: { alignSelf: 'flex-end', backgroundColor: '#2563eb33' },
  msgName: { color: '#93c5fd', fontSize: 11, marginBottom: 4 },
  msgText: { color: '#fff' },
  emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 42, marginBottom: 12, opacity: 0.45 },
  emptyTitle: { color: '#cbd5e1', fontSize: 15, fontWeight: '800', marginBottom: 6 },
  emptySubtitle: { color: '#64748b', fontSize: 12, textAlign: 'center', lineHeight: 19 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 20, marginTop: 8 },
  input: { flex: 1, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#ffffff22', borderRadius: 12, padding: 12, color: '#fff' },
  sendBtn: { backgroundColor: '#2563eb', paddingHorizontal: 20, justifyContent: 'center', borderRadius: 12 },
  sendBtnText: { color: '#fff', fontWeight: '800' },
});
