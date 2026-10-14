import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, TextInput, Text, ScrollView, ActivityIndicator, Alert, Pressable } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';

const BASE_URL = 'https://rabahdj-parental-backend.onrender.com';

const C = {
  bg: '#0b1220',
  card: '#111827',
  input: '#0d1626',
  border: '#1e293b',
  primary: '#2563eb',
  link: '#60a5fa',
  text: '#ffffff',
  label: '#e2e8f0',
  muted: '#64748b',
  danger: '#ef4444',
  success: '#10b981',
};

export default function ParentalScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isFetchingCode, setIsFetchingCode] = useState(false);
  const [codeError, setCodeError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function loadCredentials() {
      try {
        const savedUser = await SecureStore.getItemAsync('username');
        const savedFamily = await SecureStore.getItemAsync('familyId');
        const savedToken = await SecureStore.getItemAsync('userToken');
        if (savedUser && savedFamily && savedToken) {
          setUsername(savedUser);
          setFamilyId(savedFamily);
          setIsConfigured(true);
        }
      } catch (e) {
        console.log('خطأ قراءة التخزين الآمن:', e);
      } finally {
        setIsLoading(false);
      }
    }
    loadCredentials();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCountdown = (seconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSecondsLeft(seconds);
    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setPairingCode(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const generatePairingCode = async () => {
    setCodeError('');
    try {
      setIsFetchingCode(true);
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        setCodeError('انتهت الجلسة، سجّل الدخول من جديد.');
        return;
      }
      const res = await fetch(`${BASE_URL}/api/pairing/code`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.code) {
        setPairingCode(String(data.code));
        startCountdown(Number(data.expiresInSeconds) || 600);
      } else if (res.status === 429) {
        setCodeError('تجاوزت الحد المسموح (10 طلبات كل 15 دقيقة). انتظر قليلاً ثم أعد المحاولة.');
      } else if (res.status === 401) {
        setCodeError('انتهت الجلسة، سجّل الخروج ثم الدخول من جديد.');
      } else {
        setCodeError(data?.error || data?.message || 'تعذّر توليد الرمز.');
      }
    } catch (e) {
      setCodeError('تعذّر الاتصال بالخادم. تحقق من الإنترنت وأعد المحاولة.');
    } finally {
      setIsFetchingCode(false);
    }
  };

  const handleRegister = async () => {
    if (!familyName.trim() || !username.trim() || !password) {
      Alert.alert('تنبيه', 'يرجى ملء كافة الخانات المطلوبة');
      return;
    }
    try {
      setIsLoading(true);
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          family_name: familyName.trim(),
          username: username.trim(),
          password: password,
        }),
      });
      const data = await response.json().catch(() => null);
      const newFamilyId = data?.familyId ?? data?.account?.familyId;
      if (response.ok && newFamilyId) {
        Alert.alert('تم إنشاء العائلة بنجاح 🎉', `رقم عائلتك الموحد هو: ${newFamilyId}`);
        setFamilyId(String(newFamilyId));
        setIsRegistering(false);
      } else {
        Alert.alert('تنبيه التسجيل', data?.error || data?.message || 'تعذر إنشاء الحساب');
      }
    } catch (err) {
      Alert.alert('خطأ', 'تعذر الوصول إلى الخادم');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!familyId.trim() || !username.trim() || !password) {
      Alert.alert('بيانات ناقصة', 'أدخل رقم العائلة واسم المستخدم وكلمة المرور.');
      return;
    }
    try {
      setIsLoading(true);
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familyId: familyId.trim(),
          username: username.trim(),
          password: password,
        }),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.token) {
        await SecureStore.setItemAsync('userToken', data.token);
        await SecureStore.setItemAsync('username', username.trim());
        await SecureStore.setItemAsync('familyId', familyId.trim());
        setPassword('');
        setIsConfigured(true);
      } else {
        Alert.alert('خطأ في الدخول', data?.error || data?.message || 'البيانات غير مطابقة');
      }
    } catch (e) {
      Alert.alert('خطأ شبكي', 'تعذّر الاتصال بالسيرفر');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    await SecureStore.deleteItemAsync('username');
    await SecureStore.deleteItemAsync('familyId');
    await SecureStore.deleteItemAsync('userToken');
    setPassword('');
    setPairingCode(null);
    setSecondsLeft(0);
    setCodeError('');
    setIsConfigured(false);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

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
            <Text style={styles.title}>
              {isRegistering ? 'إنشاء حساب عائلة جديد 👨‍👩‍👦' : 'تسجيل دخول ولي الأمر 🔒'}
            </Text>
            {isRegistering && (
              <>
                <Text style={styles.label}>اسم أو لقب العائلة:</Text>
                <TextInput style={styles.input} placeholder="مثال: عائلة رباح" placeholderTextColor={C.muted} value={familyName} onChangeText={setFamilyName} />
              </>
            )}
            {!isRegistering && (
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
              <Text style={styles.primaryBtnText}>
                {isRegistering ? 'إتمام التسجيل وتوليد رقم العائلة' : 'دخول إلى لوحة التحكم الأبوية'}
              </Text>
            </Pressable>

            <Text style={styles.switchText} onPress={() => setIsRegistering(!isRegistering)}>
              {isRegistering ? 'تملك حساب عائلة بالفعل؟ سجل دخولك الآن' : 'لا تملك رقم عائلة؟ أنشئ حساباً جديداً للأسرة'}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.dashContainer}>
        <Text style={styles.dashTitle}>لوحة التحكم الأبوية 👨‍💼</Text>

        <View style={styles.card}>
          <Text style={styles.cardText}>مرحباً بك يا <Text style={{ color: C.link, fontWeight: 'bold' }}>{username}</Text></Text>
          <Text style={styles.cardText}>رقم العائلة الموحد: <Text style={{ color: C.success, fontWeight: 'bold' }}>{familyId}</Text></Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>🔑 رمز ربط جهاز الطفل</Text>
          <Text style={styles.cardSubText}>ولّد رمزاً واكتبه في هاتف الطفل. الرمز صالح 10 دقائق ويُستخدم مرة واحدة.</Text>

          {isFetchingCode ? (
            <ActivityIndicator size="small" color={C.link} style={{ marginVertical: 18 }} />
          ) : pairingCode ? (
            <>
              <Text style={styles.roomCode} selectable>{pairingCode}</Text>
              <Text style={styles.timerText}>ينتهي خلال {fmt(secondsLeft)}</Text>
            </>
          ) : null}

          {!!codeError && <Text style={styles.errorText}>{codeError}</Text>}

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }, isFetchingCode && { opacity: 0.5 }]}
            onPress={generatePairingCode}
            disabled={isFetchingCode}
          >
            <Text style={styles.primaryBtnText}>{pairingCode ? 'توليد رمز جديد' : 'توليد رمز الربط'}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>📡 الأجهزة المربوطة</Text>
          <Text style={styles.cardSubText}>لا توجد أجهزة مربوطة بعد.</Text>
        </View>

        <Pressable style={({ pressed }) => [styles.dangerBtn, pressed && { opacity: 0.8 }]} onPress={handleReset}>
          <Text style={styles.primaryBtnText}>⚙️ تسجيل الخروج وتعديل الحساب</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  container: { flexGrow: 1, backgroundColor: C.bg, justifyContent: 'center', padding: 20 },
  dashContainer: { flexGrow: 1, backgroundColor: C.bg, padding: 20, paddingBottom: 30 },
  center: { alignItems: 'center', justifyContent: 'center' },
  formContainer: { backgroundColor: C.card, padding: 25, borderRadius: 24, borderWidth: 1, borderColor: C.border },
  title: { fontSize: 22, color: C.text, textAlign: 'center', marginBottom: 25, fontWeight: 'bold' },
  label: { color: C.label, fontSize: 14, marginBottom: 6, fontWeight: '600', textAlign: 'right' },
  input: { backgroundColor: C.input, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, marginBottom: 16, fontSize: 16, color: C.text, borderWidth: 1, borderColor: C.border, textAlign: 'right' },
  primaryBtn: { backgroundColor: C.primary, paddingVertical: 15, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dangerBtn: { backgroundColor: C.danger, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  switchText: { color: C.link, textAlign: 'center', marginTop: 20, textDecorationLine: 'underline', fontSize: 14, fontWeight: '500' },
  dashTitle: { fontSize: 24, color: C.text, textAlign: 'center', fontWeight: 'bold', marginBottom: 20 },
  card: { backgroundColor: C.card, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: C.border, marginBottom: 16 },
  cardText: { color: C.text, fontSize: 16, textAlign: 'right', marginBottom: 6 },
  cardLabel: { color: C.label, fontSize: 17, fontWeight: '700', textAlign: 'right', marginBottom: 8 },
  cardSubText: { color: C.muted, fontSize: 13, textAlign: 'right', marginBottom: 6 },
  roomCode: { color: C.success, fontSize: 36, fontWeight: 'bold', letterSpacing: 6, textAlign: 'center', marginVertical: 14 },
  timerText: { color: C.muted, fontSize: 13, textAlign: 'center', marginBottom: 6 },
  errorText: { color: C.danger, fontSize: 13, textAlign: 'right', marginTop: 8 },
});
