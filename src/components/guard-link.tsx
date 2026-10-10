import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as SecureStore from 'expo-secure-store';

const CHILD_KEY = 'rabahdj_guard_child';

export type GuardLinkHandle = {
  push: () => boolean;
  cmd: (command: object) => boolean;
};

type Props = {
  suggestions?: string[];
  getSyncFor?: (childUsername: string) => object | null;
};

const GuardLink = forwardRef<GuardLinkHandle, Props>(
  function GuardLink({ suggestions = [], getSyncFor }, ref) {
    const webRef = useRef<WebView>(null);
    const [child, setChild] = useState('');
    const [status, setStatus] = useState('غير متصل');
    const [ready, setReady] = useState(false);

    const send = (value: object): boolean => {
      if (!ready || !webRef.current) {
        Alert.alert('الاتصال غير جاهز', 'لم يتم إنشاء قناة اتصال بعد.');
        return false;
      }

      webRef.current.postMessage(JSON.stringify(value));
      return true;
    };

    useImperativeHandle(ref, () => ({
      push: () => {
        const username = child.trim();
        if (!username) return false;

        const rules = getSyncFor?.(username);
        if (!rules) return false;

        return send({ type: 'sync-rules', child: username, rules });
      },
      cmd: (command) => send(command),
    }));

    const connect = async () => {
      const username = child.trim();
      if (!username) {
        Alert.alert('اسم الطفل مطلوب', 'أدخل اسم حساب الطفل أولًا.');
        return;
      }

      await SecureStore.setItemAsync(CHILD_KEY, username);
      setStatus('تم حفظ الاسم؛ انتظار تهيئة الاتصال');
      Alert.alert(
        'تم حفظ الاسم',
        'حُفظ اسم الطفل على هذا الجهاز. لم يُنشأ اتصال بعيد بعد.',
      );
    };

    const onMessage = (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data?.type === 'ready') setReady(true);
        if (data?.type === 'state') setStatus(String(data.state ?? status));
      } catch {
        // تجاهل الرسائل غير الصالحة
      }
    };

    return (
      <View style={styles.container}>
        <Text style={styles.title}>GuardLink — رقابة الأسرة</Text>
        <Text style={styles.status}>الحالة: {status}</Text>

        <TextInput
          value={child}
          onChangeText={setChild}
          placeholder="اسم حساب الطفل"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          style={styles.input}
        />

        {suggestions.slice(0, 5).map((name) => (
          <Pressable
            key={name}
            onPress={() => setChild(name)}
            style={styles.suggestion}
          >
            <Text style={styles.suggestionText}>{name}</Text>
          </Pressable>
        ))}

        <Pressable onPress={connect} style={styles.button}>
          <Text style={styles.buttonText}>حفظ اسم الطفل</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            const username = child.trim();
            const rules = username ? getSyncFor?.(username) : null;
            if (!rules) {
              Alert.alert('لا توجد قواعد', 'اختر حسابًا لديه قواعد محفوظة.');
              return;
            }
            send({ type: 'sync-rules', child: username, rules });
          }}
          style={styles.secondaryButton}
        >
          <Text style={styles.buttonText}>طلب مزامنة القواعد</Text>
        </Pressable>

        <Text style={styles.note}>
          هذه واجهة أولية. الاتصال البعيد وتطبيق القواعد على جهاز الطفل يحتاجان
          إلى خدمة اتصال وطرف طفل متوافق؛ لا يوجد قفل فعلي للجهاز في هذه النسخة.
        </Text>

        <WebView
          ref={webRef}
          source={{
            html: '<!doctype html><html><body><script>document.addEventListener("message",function(e){ });window.addEventListener("message",function(e){ });</script></body></html>',
          }}
          onMessage={onMessage}
          onLoadEnd={() => setReady(true)}
          style={styles.webview}
          originWhitelist={['*']}
          javaScriptEnabled
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#111827',
    gap: 10,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  status: {
    color: '#cbd5e1',
  },
  input: {
    color: '#fff',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestion: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#1e293b',
  },
  suggestionText: {
    color: '#e2e8f0',
  },
  button: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  secondaryButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  note: {
    color: '#fbbf24',
    fontSize: 12,
    lineHeight: 18,
  },
  webview: {
    width: 1,
    height: 1,
    opacity: 0.01,
  },
});

export default GuardLink;
