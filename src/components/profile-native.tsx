import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Image } from 'react-native';

export type ProfileState = { name: string; status: string; avatar: string };

type Props = {
  profile: ProfileState | null;
  onSave: (name: string, status: string) => void;
  onPickAvatar: () => void;
  onBack: () => void;
};

export default function ProfileNative({ profile, onSave, onPickAvatar, onBack }: Props) {
  const [name, setName] = useState(profile?.name ?? '');
  const [status, setStatus] = useState(profile?.status ?? '');

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setStatus(profile.status);
    }
  }, [profile]);

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <TouchableOpacity style={styles.back} onPress={onBack}>
          <Text style={styles.backText}>← رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.title}>ملفي</Text>
        <View style={{ width: 70 }} />
      </View>

      <TouchableOpacity style={styles.avatarWrap} onPress={onPickAvatar} activeOpacity={0.8}>
        {profile?.avatar ? (
          <Image source={{ uri: profile.avatar }} style={styles.avatarImg} />
        ) : (
          <Text style={styles.avatarEmoji}>👤</Text>
        )}
        <View style={styles.avatarBadge}>
          <Text style={styles.avatarBadgeText}>📷</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.box}>
        <Text style={styles.label}>الاسم</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="اسمك" placeholderTextColor="#64748b" />
        <Text style={styles.label}>الحالة / نبذة عني</Text>
        <TextInput style={styles.input} value={status} onChangeText={setStatus} placeholder="مثلاً: متصل دائمًا 👋" placeholderTextColor="#64748b" />
        <TouchableOpacity style={styles.saveBtn} onPress={() => onSave(name.trim(), status.trim())}>
          <Text style={styles.saveBtnText}>حفظ الملف الشخصي</Text>
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
  avatarWrap: {
    width: 110, height: 110, borderRadius: 55, backgroundColor: '#2563eb33', borderWidth: 2, borderColor: '#ffffff22',
    justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 20,
  },
  avatarBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#2563eb', borderWidth: 2, borderColor: '#0b1220', justifyContent: 'center', alignItems: 'center',
  },
  avatarBadgeText: { fontSize: 14 },
  avatarImg: { width: '100%', height: '100%' },
  avatarEmoji: { fontSize: 44 },
  box: { backgroundColor: '#ffffff0a', borderWidth: 1, borderColor: '#ffffff14', borderRadius: 18, padding: 16 },
  label: { color: '#94a3b8', fontSize: 13, marginBottom: 8, marginTop: 4 },
  input: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#ffffff22', borderRadius: 12, padding: 12, color: '#fff', marginBottom: 10 },
  saveBtn: { backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: '800' },
});
