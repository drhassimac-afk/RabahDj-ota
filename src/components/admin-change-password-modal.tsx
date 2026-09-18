import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (oldPass: string, newUser: string, newPass: string) => void;
  error?: string | null;
};

export default function AdminChangePasswordModal({ visible, onClose, onSubmit, error }: Props) {
  const [oldPass, setOldPass] = useState('');
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>تغيير بيانات دخول المسؤول</Text>
          <TextInput style={styles.input} placeholder="كلمة السر الحالية" placeholderTextColor="#8892b0" secureTextEntry value={oldPass} onChangeText={setOldPass} />
          <TextInput style={[styles.input, { marginTop: 10 }]} placeholder="اسم المستخدم الجديد" placeholderTextColor="#8892b0" autoCapitalize="none" value={newUser} onChangeText={setNewUser} />
          <TextInput style={[styles.input, { marginTop: 10 }]} placeholder="كلمة السر الجديدة" placeholderTextColor="#8892b0" secureTextEntry value={newPass} onChangeText={setNewPass} />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity style={styles.submitBtn} onPress={() => onSubmit(oldPass, newUser, newPass)}>
            <Text style={styles.submitText}>حفظ</Text>
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
  title: { color: '#fff', fontSize: 17, fontWeight: '900', textAlign: 'center', marginBottom: 18 },
  input: { backgroundColor: '#0f172a', borderRadius: 12, borderWidth: 1, borderColor: '#ffffff22', color: '#fff', padding: 14, fontSize: 15, textAlign: 'right' },
  error: { color: '#ff5252', fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 10 },
  submitBtn: { backgroundColor: '#16a34a', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
