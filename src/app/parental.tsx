import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, Button, Text, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import * as SecureStore from 'expo-secure-store';

export default function ParentalScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 🟢 النطاق السحابي الفعلي الفرعي الخاص بمشروعك بدقة لإلغاء الـ 405 تماماً
  const BASE_URL = 'https://rabahdj-parental-backend.onrender.com';

  useEffect(() => {
    async function loadCredentials() {
      try {
        const savedUser = await SecureStore.getItemAsync('username');
        const savedPass = await SecureStore.getItemAsync('password');
        const savedFamily = await SecureStore.getItemAsync('familyId');
        if (savedUser && savedPass && savedFamily) {
          setUsername(savedUser);
          setPassword(savedPass);
          setFamilyId(savedFamily);
          setIsConfigured(true);
        }
      } catch (e) { console.log('خطأ قراءة التخزين الآمن:', e); } finally { setIsLoading(false); }
    }
    loadCredentials();
  }, []);

  const handleRegister = async () => {
    if (!familyName.trim() || !username.trim() || !password.trim()) {
      Alert.alert("تنبيه", "يرجى ملء كافة الخانات المطلوبة");
      return;
    }
    try {
      setIsLoading(true);
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        body: JSON.stringify({ family_name: familyName.trim(), username: username.trim(), password: password.trim() })
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.familyId) {
        const generatedId = data.familyId.toString();
        Alert.alert("تم إنشاء العائلة بنجاح 🎉", `رقم عائلتك الموحد هو: ${generatedId}\nاحفظه جيداً لربط بقية الأجهزة!`);
        setFamilyId(generatedId);
        setIsRegistering(false);
      } else {
        Alert.alert("تنبيه التسجيل", data?.message || "اسم المستخدم محجوز مسبقاً");
      }
    } catch (err) {
      Alert.alert("خطأ في الاتصال", "تعذر الوصول إلى خادم المراقبة الفعلي");
    } finally { setIsLoading(false); }
  };

  const handleLogin = async () => {
    if (!familyId.trim() || !username.trim() || !password) {
      Alert.alert('بيانات ناقصة', 'أدخل معرّف العائلة واسم المستخدم وكلمة المرور.');
      return;
    }
    setIsLoading(true);

    const loginBody = {
      familyId: familyId.trim(),
      username: username.trim(),
      password: password,
    };

    try {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        body: JSON.stringify(loginBody),
      });

      const rawText = await response.text();

      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        console.log('ردّ غير JSON:', response.status, rawText.slice(0, 200));
        Alert.alert('خطأ في الدخول', `استجابة غير صالحة من السيرفر (${response.status})`);
        return;
      }

      if (!response.ok) {
        Alert.alert('خطأ في الدخول', data.message || data.error || `خطأ ${response.status}`);
        return;
      }

      if (!data.token) {
        Alert.alert('خطأ في الدخول', 'لم يتم إرجاع رمز الدخول الرسمي من السيرفر.');
        return;
      }

      // حفظ السجلات وتأمين العبور للوحة التحكم الأبوية
      await SecureStore.setItemAsync('userToken', data.token);
      await SecureStore.setItemAsync('username', username.trim());
      await SecureStore.setItemAsync('password', password);
      await SecureStore.setItemAsync('familyId', familyId.trim());
      setIsConfigured(true);

    } catch (e) {
      console.log('خطأ الدخول:', e);
      Alert.alert('خطأ في الدخول', 'تعذّر الاتصال بالسيرفر');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    await SecureStore.deleteItemAsync('username');
    await SecureStore.deleteItemAsync('password');
    await SecureStore.deleteItemAsync('familyId');
    await SecureStore.deleteItemAsync('userToken');
    setIsConfigured(false);
  };

  if (isLoading) {
    return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color="#00ff88" /></View>;
  }

  if (!isConfigured) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>{isRegistering ? "إنشاء حساب عائلة جديد 👨‍👩‍👦" : "تسجيل دخول ولي الأمر 🔒"}</Text>
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
            <Button title={isRegistering ? "إتمام التسجيل وتوليد رقم العائلة🚀" : "دخول إلى لوحة التحكم الأبوية🔒"} onPress={isRegistering ? handleRegister : handleLogin} color="#00ff88" />
          </View>
          <Text style={styles.switchText} onPress={() => setIsRegistering(!isRegistering)}>
            {isRegistering ? "تملك حساب عائلة بالفعل؟ سجل دخولك الآن" : "لا تملك رقم عائلة؟ أنشئ حساباً جديداً للأسرة"}
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.webContainer}>
      <WebView source={{ uri: `${BASE_URL}/dash?family=${familyId}&user=${username}` }} style={{ flex: 1 }} javaScriptEnabled={true} domStorageEnabled={true} startInLoadingState={true} />
      <View style={styles.resetBar}><Button title="⚙️ تسجيل الخروج أو تعديل الحساب الأبوي" onPress={handleReset} color="#ff4a4a" /></View>
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
