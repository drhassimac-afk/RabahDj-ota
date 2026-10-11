import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, SafeAreaView, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { requestLocationPermission, saveChildCredentials } from '@/lib/guard-sync';

const API = process.env.EXPO_PUBLIC_API_URL;

export default function PairChildScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [deviceName, setDeviceName] = useState('هاتف الطفل');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pair = async () => {
    setError('');
    if (!/^\d{8}$/.test(code.trim())) {
      setError('الرمز يتكون من 8 أرقام.');
      return;
    }
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username.trim())) {
      setError('اسم المستخدم: 3 إلى 32 حرفًا إنجليزيًا أو أرقامًا أو _ . -');
      return;
    }
    if (password.length < 10) {
      setError('كلمة المرور 10 أحرف على الأقل.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API}/api/pairing/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          username: username.trim(),
          password,
          deviceName: deviceName.trim() || 'Child phone',
          platform: 'android',
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const familyId = data?.account?.familyId;
      if (!familyId) throw new Error('رد غير متوقع من الخادم.');

      await saveChildCredentials({
        familyId: String(familyId),
        username: username.trim(),
        password,
      });
      setPassword('');

      const granted = await requestLocationPermission();

      Alert.alert(
        'تم الربط',
        granted
          ? 'تم ربط هذا الجهاز بحساب العائلة.'
          : 'تم ربط الجهاز، لكن بدون إذن الموقع لن يعمل تنبيه المناطق. يمكنك تفعيله لاحقًا من إعدادات النظام.',
      );
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر الربط.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>ربط جهاز الطفل</Text>
        <Text style={styles.muted}>أدخل الرمز الذي أنشأه وليّ الأمر من هاتفه.</Text>

        <Text style={styles.label}>رمز الربط (8 أرقام)</Text>
        <TextInput style={styles.input} value={code} keyboardType="number-pad"
          maxLength={8} onChangeText={(v) => setCode(v.replace(/[^0-9]/g, ''))}
          placeholderTextColor="#94a3b8" />

        <Text style={styles.label}>اسم المستخدم</Text>
        <TextInput style={styles.input} value={username} onChangeText={setUsername}
          autoCapitalize="none" placeholderTextColor="#94a3b8" />

        <Text style={styles.label}>كلمة المرور (10 أحرف على الأقل)</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword}
          secureTextEntry autoCapitalize="none" placeholderTextColor="#94a3b8" />

        <Text style={styles.label}>اسم الجهاز</Text>
        <TextInput style={styles.input} value={deviceName} onChangeText={setDeviceName}
          placeholderTextColor="#94a3b8" />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.button} onPress={pair} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>ربط الجهاز</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>رجوع</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b1220' },
  content: { padding: 24, paddingBottom: 40 },
  title: { color: '#fff', fontSize: 23, fontWeight: '800', textAlign: 'center', marginVertical: 16 },
  label: { color: '#cbd5e1', fontWeight: '700', fontSize: 13, marginTop: 14 },
  input: { color: '#fff', backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 11, padding: 12, marginTop: 6 },
  button: { minHeight: 48, backgroundColor: '#2563eb', borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: 12, marginTop: 20 },
  buttonText: { color: '#fff', fontWeight: '800' },
  muted: { color: '#94a3b8', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  error: { color: '#fca5a5', backgroundColor: '#7f1d1d33', borderRadius: 10, padding: 10, marginTop: 14 },
  link: { color: '#93c5fd', fontWeight: '700', textAlign: 'center', paddingVertical: 16 },
});
