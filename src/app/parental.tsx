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
      Alert.alert('تنبيه', 'يرجى fill جميع الحقول لإنشاء العائلة'); return;
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
