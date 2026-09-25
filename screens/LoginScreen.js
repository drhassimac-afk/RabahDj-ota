import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  login,
  saveCredentials,
  getSavedCredentials,
} from '../api/xtream';

export default function LoginScreen({ navigation }) {
  const [server, setServer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSaved, setCheckingSaved] = useState(true);

  useEffect(() => {
    (async () => {
      const saved = await getSavedCredentials();

      if (saved) {
        try {
          await login(saved);
          navigation.replace('Categories', { creds: saved });
          return;
        } catch (e) {
          // البيانات المحفوظة غير صالحة، نعرض تسجيل الدخول اليدوي
        }
      }

      setCheckingSaved(false);
    })();
  }, []);

  async function handleLogin() {
    if (!server || !username || !password) {
      Alert.alert('تنبيه', 'عبّي كل الحقول قبل المتابعة');
      return;
    }

    setLoading(true);

    try {
      const creds = {
        server: server.trim(),
        username: username.trim(),
        password: password.trim(),
      };

      await login(creds);
      await saveCredentials(creds);

      navigation.replace('Categories', { creds });
    } catch (e) {
      Alert.alert(
        'فشل تسجيل الدخول',
        e instanceof Error ? e.message : String(e)
      );
    } finally {
      setLoading(false);
    }
  }

  if (checkingSaved) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1e90ff" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>تسجيل الدخول IPTV</Text>

      <TextInput
        style={styles.input}
        placeholder="رابط السيرفر (http://example.com:8080)"
        placeholderTextColor="#888"
        value={server}
        onChangeText={setServer}
        autoCapitalize="none"
        keyboardType="url"
        textAlign="right"
      />

      <TextInput
        style={styles.input}
        placeholder="اسم المستخدم"
        placeholderTextColor="#888"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        textAlign="right"
      />

      <TextInput
        style={styles.input}
        placeholder="كلمة المرور"
        placeholderTextColor="#888"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        textAlign="right"
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>دخول</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    padding: 24,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },

  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
  },

  input: {
    backgroundColor: '#1c1c1e',
    color: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    fontSize: 15,
  },

  button: {
    backgroundColor: '#1e90ff',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },

  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
