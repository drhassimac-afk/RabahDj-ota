import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, Text, ScrollView, ActivityIndicator, Alert, Pressable } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_URL } from '../lib/config';
import { startRemoteStream, stopRemoteStream } from '../lib/guard-sync';

const C = {
  bg: '#0b1220', card: '#111827', input: '#0d1626', border: '#1e293b',
  primary: '#2563eb', link: '#60a5fa', text: '#ffffff', label: '#e2e8f0',
  muted: '#64748b', danger: '#ef4444', success: '#10b981',
};

export default function ParentalScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [isConnectingStream, setIsConnectingStream] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    async function loadCredentials() {
      try {
        const savedUser = await SecureStore.getItemAsync('username');
        const savedFamily = await SecureStore.getItemAsync('familyId');
        const savedToken = await SecureStore.getItemAsync('userToken');
        if (savedUser && savedFamily && savedToken) {
          setUsername(savedUser); setFamilyId(savedFamily); setIsConfigured(true);
        }
      } catch (e) { console.log(e); } finally { setIsLoading(false); }
    }
    loadCredentials();
  }, []);

  const handleRegister = async () => {
    if (!familyName.trim() || !username.trim() || !password) {
      Alert.alert('تنبيه', 'يرجى ملء كافة الخانات المطلوبة لإنشاء العائلة'); return;
    }
    try {
      setIsLoading(true);
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ family_name: familyName.trim(), username: username.trim(), password }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.account?.familyId) {
        Alert.alert('تم إنشاء العائلة بنجاح 🎉', `رقم عائلتك هو: ${data.account.familyId}`);
        setFamilyId(data.account.familyId.toString()); setIsRegistering(false);
      } else { Alert.alert('تنبيه التسجيل', data?.error || data?.message || 'اسم المستخدم مستعمل سابقاً.'); }
    } catch (err) { Alert.alert('خطأ', 'تعذر الاتصال بالسيرفر السحابي.'); } finally { setIsLoading(false); }
  };

  const handleLogin = async () => {
    if (!familyId.trim() || !username.trim() || !password) {
      Alert.alert('بيانات ناقصة', 'أدخل رقم العائلة واسم المستخدم وكلمة المرور.'); return;
    }
    try {
      setIsLoading(true);
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId: familyId.trim(), username: username.trim(), password }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.token) {
        await SecureStore.setItemAsync('userToken', data.token);
        await SecureStore.setItemAsync('username', username.trim());
        await SecureStore.setItemAsync('familyId', familyId.trim());
        setPassword(''); setIsConfigured(true);
      } else { Alert.alert('خطأ في الدخول', data?.error || data?.message || 'البيانات غير مطابقة'); }
    } catch (e) { Alert.alert('خطأ شبكي', 'تعذّر الاتصال بالسيرفر'); } finally { setIsLoading(false); }
  };

  const toggleCameraStream = async () => {
    try {
      setIsConnectingStream(true);
      if (!isCameraActive) { await startRemoteStream(familyId + '_cam'); setIsCameraActive(true); }
      else { await stopRemoteStream(); setIsCameraActive(false); }
    } catch (e) { Alert.alert('خطأ', 'فشل معالج البث.'); } finally { setIsConnectingStream(false); }
  };

  const toggleMicStream = async () => {
    try {
      if (!isMicActive) { await startRemoteStream(familyId + '_mic'); setIsMicActive(true); }
      else { await stopRemoteStream(); setIsMicActive(false); }
    } catch (e) { console.log(e); }
  };

  const handleReset = async () => {
    await SecureStore.deleteItemAsync('username');
    await SecureStore.deleteItemAsync('familyId');
    await SecureStore.deleteItemAsync('userToken');
    setIsConfigured(false);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.center]}>
        <ActivityIndicator size="large" color={C.primary} />
      </SafeAreaView>
    );
  }

  if (!isConfigured) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.formContainer}>
            <Text style={styles.title}>{isRegistering ? 'إنشاء حساب عائلة جديد 👨‍👩‍👦' : 'تسجيل دخول ولي الأمر 🔒'}</Text>
            {isRegistering ? (
              <>
                <Text style={styles.label}>اسم أو لقب العائلة:</Text>
                <TextInput style={styles.input} placeholder="مثال: عائلة رباح" placeholderTextColor={C.muted} value={familyName} onChangeText={setFamilyName} />
              </>
            ) : (
              <>
                <Text style={styles.label}>رقم العائلة الموحد (Family ID):</Text>
                <TextInput style={styles.input} placeholder="أدخل رقم العائلة" placeholderTextColor={C.muted} value={familyId} onChangeText={setFamilyId} keyboardType="numeric" />
              </>
            )}
            <Text style={styles.label}>اسم المستخدم لولي الأمر:</Text>
            <TextInput style={styles.input} placeholder="اختر اسم مستخدم" placeholderTextColor={C.muted} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />
            <Text style={styles.label}>كلمة المرور السرية:</Text>
            <TextInput style={styles.input} placeholder="أدخل كلمة السر" placeholderTextColor={C.muted} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} />
            <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }]} onPress={isRegistering ? handleRegister : handleLogin}>
              <Text style={styles.primaryBtnText}>{isRegistering ? 'إتمام التسجيل وتوليد رقم العائلة 🚀' : 'دخول إلى لوحة التحكم الأبوية 🔒'}</Text>
            </Pressable>
            <Text style={styles.switchText} onPress={() => setIsRegistering(!isRegistering)}>
              {isRegistering ? 'تملك حساب عائلة بالفعل? سجل دخولك الآن' : 'لا تملك رقم عائلة؟ أنشئ حساباً جديداً للأسرة'}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.dashboardContainer}>
          <Text style={styles.dashTitle}>لوحة التحكم الأبوية الحية 👨‍💼</Text>
          <View style={styles.card}>
            <Text style={styles.cardText}>مرحباً بك ولي الأمر: <Text style={{color: C.link, fontWeight:'bold'}}>{username}</Text></Text>
            <Text style={styles.cardText}>رقم العائلة الموحد: <Text style={{color: C.success, fontWeight:'bold'}}>{familyId}</Text></Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>🎥 ميزات الـ FlashGet Kids الحية عن بُعد</Text>
            <Text style={styles.cardSubText}>تحكم في الكاميرا واستمع للصوت الفعلي لهاتف الطفل حياً ومباشرة كالمحترفين:</Text>
            <View style={styles.mediaButtonsRow}>
              <Pressable style={({ pressed }) => [styles.mediaBtn, isCameraActive ? styles.btnActive : styles.btnInactive, pressed && { opacity: 0.8 }]} onPress={toggleCameraStream} disabled={isConnectingStream}>
                {isConnectingStream ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.mediaBtnText}>{isCameraActive ? '🛑 إيقاف الكاميرا' : '📷 فتح الكاميرا حياً'}</Text>}
              </Pressable>
              <Pressable style={({ pressed }) => [styles.mediaBtn, isMicActive ? styles.btnActive : styles.btnInactive, pressed && { opacity: 0.8 }]} onPress={toggleMicStream}>
                <Text style={styles.mediaBtnText}>{isMicActive ? '🔇 كتم الصوت' : '🎙️ استماع للصوت'}</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.card}>
            <Text style={[styles.cardLabel, {color: C.success}]}>📡 حالة اتصال الأجهزة المتصلة</Text>
            <Text style={{color: C.text, fontSize: 14, marginTop: 10, textAlign:'right'}}>• هاتف الطفل (Samsung Tab): <Text style={{color: C.success, fontWeight:'bold'}}>نشط ومربوط</Text></Text>
          </View>
          <Pressable style={({ pressed }) => [styles.dangerBtn, pressed && { opacity: 0.8 }, { marginTop: 30 }]} onPress={handleReset}>
            <Text style={styles.dangerBtnText}>⚙️ تسجيل الخروج وتعديل الحساب الأبوي</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  container: { flexGrow: 1, backgroundColor: C.bg, justifyContent: 'center', padding: 20 },
  center: { alignItems: 'center', justifyContent: 'center' },
  formContainer: { backgroundColor: C.card, padding: 25, borderRadius: 20, borderWidth: 1, borderColor: C.border },
  dashboardContainer: { width: '100%' },
  title: { fontSize: 22, color: C.text, textAlign: 'center', marginBottom: 25, fontWeight: 'bold' },
  dashTitle: { fontSize: 24, color: C.text, textAlign: 'center', marginBottom: 20, fontWeight: 'bold' },
  label: { color: C.label, fontSize: 14, marginBottom: 6, fontWeight: '600', textAlign: 'right' },
  input: { backgroundColor: C.input, padding: 14, borderRadius: 12, marginBottom: 16, fontSize: 16, color: C.text, borderWidth: 1, borderColor: C.border, textAlign: 'right' },
  primaryBtn: { backgroundColor: C.primary, padding: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  primaryBtnText: { color: C.text, fontSize: 16, fontWeight: 'bold' },
  mediaButtonsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 5 },
  mediaBtn: { flex: 0.48, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnInactive: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: C.border },
  btnActive: { backgroundColor: '#ef4444' },
  mediaBtnText: { color: C.text, fontSize: 14, fontWeight: 'bold' },
  dangerBtn: { backgroundColor: C.danger, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', width: '100%' },
  dangerBtnText: { color: C.text, fontSize: 15, fontWeight: 'bold' },
  switchText: { color: C.link, textAlign: 'center', marginTop: 22, textDecorationLine: 'underline', fontSize: 14, fontWeight: '500' },
  card: { backgroundColor: C.card, padding: 20, borderRadius: 16, marginTop: 15, borderWidth: 1, borderColor: C.border },
  cardText: { color: C.text, fontSize: 16, textAlign: 'right', marginBottom: 5 },
  cardLabel: { color: C.link, fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  cardSubText: { color: C.muted, fontSize: 13, marginTop: 5, marginBottom: 15, textAlign: 'right' }
});
