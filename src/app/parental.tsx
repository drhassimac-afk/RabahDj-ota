import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, Button, Text, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'https://rabahdj-parental-backend.onrender.com';

const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

export default function ParentalScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
    if (!familyName.trim() || !username.trim() || !password.trim()) {
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
          password: password.trim(),
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
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#00ff88" />
      </View>
    );
  }

  if (!isConfigured) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>
            {isRegistering ? 'إنشاء حساب عائلة جديد 👨‍👩‍👦' : 'تسجيل دخول ولي الأمر 🔒'}
          </Text>
          {isRegistering && (
            <>
              <Text style={styles.label}>اسم أو لقب العائلة:</Text>
              <TextInput style={styles.input} placeholder="مثال: عائلة رباح" placeholderTextColor="#aaa" value={familyName} onChangeText={setFamilyName} />
            </>
          )}
          {!isRegistering && (
            <>
              <Text style={styles.label}>رقم العائلة الموحد (Family ID):</Text>
              <TextInput style={styles.input} placeholder="أدخل رقم العائلة" placeholderTextColor="#aaa" value={familyId} onChangeText={setFamilyId} keyboardType="numeric" />
            </>
          )}
          <Text style={styles.label}>اسم المستخدم لولي الأمر:</Text>
          <TextInput style={styles.input} placeholder="اختر اسم مستخدم" placeholderTextColor="#aaa" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />
          <Text style={styles.label}>كلمة المرور السرية:</Text>
          <TextInput style={styles.input} placeholder="أدخل كلمة السر" placeholderTextColor="#aaa" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} />
          <View style={styles.buttonSpacing}>
            <Button
              title={isRegistering ? 'إتمام التسجيل وتوليد رقم العائلة 🚀' : 'دخول إلى لوحة التحكم الأبوية 🔒'}
              onPress={isRegistering ? handleRegister : handleLogin}
              color="#00ff88"
            />
          </View>
          <Text style={styles.switchText} onPress={() => setIsRegistering(!isRegistering)}>
            {isRegistering ? 'تملك حساب عائلة بالفعل؟ سجل دخولك الآن' : 'لا تملك رقم عائلة؟ أنشئ حساباً جديداً للأسرة'}
          </Text>
        </View>
      </ScrollView>
    );
  }

  const localHtmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: system-ui; background: #0b1220; color: #fff; padding: 20px; text-align: center; direction: rtl; }
        .card { background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; margin-top: 20px; border: 1px solid #00ff88; }
        h1 { color: #00ff88; font-size: 24px; }
        .demo-badge { background: #ffaa00; color: #000; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 12px; display: inline-block; margin-bottom: 10px; }
      </style>
    </head>
    <body>
      <div class="demo-badge">⚠️ واجهة عرض تجريبية مؤقتة</div>
      <h1>لوحة التحكم الأبوية 👨‍💼</h1>
      <div class="card">
        <p>مرحباً بك يا <b>${esc(username)}</b></p>
        <p>رقم العائلة الموحد: <b style="color:#00ff88">${esc(familyId)}</b></p>
      </div>
      <p style="font-size: 13px; color: #aaa; margin-top: 30px;">بانتظار ربط مسارات جلب بيانات الأجهزة الفعلية...</p>
    </body>
    </html>
  `;

  return (
    <View style={styles.webContainer}>
      <WebView source={{ html: localHtmlContent }} style={{ flex: 1 }} javaScriptEnabled={true} domStorageEnabled={true} />
      <View style={styles.resetBar}>
        <Button title="⚙️ تسجيل الخروج وتعديل الحساب" onPress={handleReset} color="#ff4a4a" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#0b1220', justifyContent: 'center', padding: 20 },
  center: { alignItems: 'center' },
  formContainer: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 25, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  title: { fontSize: 22, color: '#fff', textAlign: 'center', marginBottom: 25, fontWeight: 'bold' },
  label: { color: '#00ff88', fontSize: 14, marginBottom: 5, fontWeight: '600' },
  input: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 15, fontSize: 16, color: '#333' },
  buttonSpacing: { marginTop: 10, borderRadius: 8, overflow: 'hidden' },
  switchText: { color: '#4fd0e7', textAlign: 'center', marginTop: 20, textDecorationLine: 'underline', fontSize: 14, fontWeight: '500' },
  webContainer: { flex: 1, backgroundColor: '#fff' },
  resetBar: { height: 45, backgroundColor: '#f5f5f5', justifyContent: 'center' }
});
