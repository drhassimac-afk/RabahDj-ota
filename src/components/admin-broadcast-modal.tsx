import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
};

export default function AdminBroadcastModal({ visible, onClose, onSubmit }: Props) {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setText('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.icon}>📢</Text>
          <Text style={styles.title}>إعلان جماعي للغرفة</Text>
          <Text style={styles.subtitle}>يظهر لكل الأعضاء المتصلين حاليًا كرسالة من الإدارة</Text>
          <TextInput
            style={styles.input}
            placeholder="اكتب نص الإعلان هنا..."
            placeholderTextColor="#8892b0"
            value={text}
            onChangeText={setText}
            multiline
            numberOfLines={4}
          />
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
            <Text style={styles.submitText}>إرسال للجميع</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(2,6,13,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  box: { width: '100%', maxWidth: 360, backgroundColor: 'rgba(15,20,35,0.95)', borderRadius: 26, padding: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  closeBtn: { position: 'absolute', top: 14, left: 14, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#fff', fontSize: 16 },
  icon: { fontSize: 30, textAlign: 'center', marginBottom: 10 },
  title: { color: '#fff', fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 6 },
  subtitle: { color: '#8892b0', fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 18 },
  input: { backgroundColor: '#0f172a', borderRadius: 12, borderWidth: 1, borderColor: '#ffffff22', color: '#fff', padding: 14, fontSize: 15, textAlign: 'right', minHeight: 90, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: '#2563eb', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
