import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, Text, ScrollView, ActivityIndicator, Alert, Pressable } from 'react-native';
import { WebView } from 'react-native-webview';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

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
};

const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

export default function ParentalScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const insets = useSafeAreaInsets();

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
  }, []);

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
      if (response.ok && data?.familyId) {
        Alert.alert('تم إنشاء العائلة بنجاح 🎉', `رقم عائلتك الموحد هو: ${data.familyId}`);
        setFamilyId(data.familyId.toString());
        setIsRegistering(false);
      } else {
        Alert.alert('تنبيه التسجيل', data?.error || data?.message || 'تعذر الإنشاء');
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
        Alert.alert('خطأ في الدخول', data?.error || data?.message || 'رقم العائلة أو البيانات غير مطابقة');
      }
    } catch (e) {
      Alert.alert('خطأ شبكي', 'تعذّر الاتصال بالسيرفر');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    await SecureStore.deleteItemAsync('username');
    await SecureStore.deleteItemAsync('familyId');
    await SecureStore.deleteItemAsync('userToken');
    setPassword('');
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

            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }]}
              onPress={isRegistering ? handleRegister : handleLogin}
            >
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

  const localHtmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: system-ui; background: ${C.bg}; color: #fff; padding: 20px; text-align: center; direction: rtl; }
        .card { background: ${C.card}; padding: 20px; border-radius: 16px; margin-top: 20px; border: 1px solid ${C.primary}; }
        h1 { color: #fff; font-size: 24px; font-weight: 700; }
        .demo-badge { background: #f59e0b; color: #000; padding: 5px 12px; border-radius: 8px; font-weight: bold; font-size: 12px; display: inline-block; margin-bottom: 10px; }
      </style>
    </head>
    <body>
      <div class="demo-badge">⚠️ واجهة عرض تجريبية مؤقتة</div>
      <h1>لوحة التحكم الأبوية 👨‍💼</h1>
      <div class="card">
        <p>مرحباً بك يا <b>${esc(username)}</b></p>
        <p>رقم العائلة الموحد: <b style="color:${C.link}">${esc(familyId)}</b></p>
      </div>
      <p style="font-size: 13px; color: ${C.muted}; margin-top: 30px;">بانتظار ربط مسارات جلب بيانات الأجهزة الفعلية...</p>
    </body>
    </html>
  `;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.webContainer}>
        <WebView source={{ html: localHtmlContent }} style={{ flex: 1, backgroundColor: C.bg }} javaScriptEnabled={true} domStorageEnabled={true} />
        <View style={[styles.resetBar, { paddingBottom: insets.bottom + 8 }]}>
          <Pressable
            style={({ pressed }) => [styles.dangerBtn, pressed && { opacity: 0.8 }]}
            onPress={handleReset}
          >
            <Text style={styles.primaryBtnText}>⚙️ تسجيل الخروج وتعديل الحساب</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  container: { flexGrow: 1, backgroundColor: C.bg, justifyContent: 'center', padding: 20 },
  center: { alignItems: 'center', justifyContent: 'center' },
  formContainer: { backgroundColor: C.card, padding: 25, borderRadius: 24, borderWidth: 1, borderColor: C.border },
  title: { fontSize: 22, color: C.text, textAlign: 'center', marginBottom: 25, fontWeight: 'bold' },
  label: { color: C.label, fontSize: 14, marginBottom: 6, fontWeight: '600', textAlign: 'right' },
  input: { backgroundColor: C.input, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, marginBottom: 16, fontSize: 16, color: C.text, borderWidth: 1, borderColor: C.border, textAlign: 'right' },
  primaryBtn: { backgroundColor: C.primary, paddingVertical: 15, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dangerBtn: { backgroundColor: C.danger, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  switchText: { color: C.link, textAlign: 'center', marginTop: 20, textDecorationLine: 'underline', fontSize: 14, fontWeight: '500' },
  webContainer: { flex: 1, backgroundColor: C.bg },
  resetBar: { backgroundColor: C.bg, paddingHorizontal: 15, paddingTop: 10, borderTopWidth: 1, borderColor: C.border }
});
