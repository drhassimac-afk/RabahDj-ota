import React, { useCallback, useEffect, useRef, useState } from 'react';
import GuardLink, { type GuardLinkHandle } from '@/components/guard-link';
import {
  ActivityIndicator, Alert, SafeAreaView, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

const API = 'https://rabahdj-parental-backend.onrender.com';
const TOKEN_KEY = 'rabahdj_parental_token';

type Rule = {
  child_account_id: string;
  child_username: string;
  daily_limit_minutes: number;
  bedtime_start: string;
  bedtime_end: string;
  timezone: string;
  enabled: boolean;
};
type Device = {
  id: string;
  device_name: string;
  platform?: string;
  last_seen_at?: string;
  child_username?: string;
};
type Edit = {
  limit: string;
  start: string;
  end: string;
  timezone: string;
  enabled: boolean;
};

async function json(response: Response): Promise<any> {
  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`استجابة غير صالحة من الخادم (${response.status})`);
  }
  if (!response.ok) {
    throw new Error(data.message || data.error || `HTTP ${response.status}`);
  }
  return data;
}

const hhmm = (v?: string) => (v || '21:00').slice(0, 5);

export default function ParentalScreen() {
  const guardRef = useRef<GuardLinkHandle>(null);
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [accountName, setAccountName] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async (auth: string) => {
    const headers = { Authorization: `Bearer ${auth}` };
    const [d, r] = await Promise.all([
      fetch(`${API}/api/parent/devices`, { headers }).then(json),
      fetch(`${API}/api/parent/usage-rules`, { headers }).then(json),
    ]);
    const nextDevices: Device[] = Array.isArray(d.devices) ? d.devices : [];
    const nextRules: Rule[] = Array.isArray(r.usageRules) ? r.usageRules : [];
    setDevices(nextDevices);
    setRules(nextRules);
    setEdits(Object.fromEntries(nextRules.map((item) => [
      item.child_account_id,
      {
        limit: String(item.daily_limit_minutes ?? 120),
        start: hhmm(item.bedtime_start),
        end: hhmm(item.bedtime_end),
        timezone: item.timezone || 'Africa/Algiers',
        enabled: item.enabled !== false,
      },
    ])));
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(TOKEN_KEY);
        if (saved) {
          await load(saved);
          if (active) setToken(saved);
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'تعذر الاتصال بالخادم.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [load]);

  const login = async () => {
    if (!familyId.trim() || !username.trim() || !password) {
      Alert.alert(
        'بيانات ناقصة',
        'أدخل معرّف العائلة واسم المستخدم وكلمة المرور.'
      );
      return;
    }

    setBusy(true);
    setError('');

    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familyId: familyId.trim(),
          username: username.trim(),
          password,
        }),
      });

      const data = await json(response);

      if (!data.token) {
        throw new Error('لم يُرجع الخادم رمز الدخول.');
      }

      if (data.account?.role && data.account.role !== 'parent') {
        throw new Error('هذا الحساب ليس حساب وليّ أمر.');
      }

      await SecureStore.setItemAsync(TOKEN_KEY, data.token);
      setAccountName(data.account?.username || username.trim());
      setToken(data.token);
      setPassword('');

      try {
        await load(data.token);
      } catch (e) {
        setError(
          'تم تسجيل الدخول، لكن تعذر تحميل الأجهزة والقواعد: ' +
          (e instanceof Error ? e.message : 'خطأ غير معروف')
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل تسجيل الدخول.');
    } finally {
      setBusy(false);
    }
  };

  const change = (id: string, patch: Partial<Edit>) => {
    setEdits((old) => ({ ...old, [id]: { ...old[id], ...patch } }));
  };

  const save = async (rule: Rule) => {
    const edit = edits[rule.child_account_id];
    if (!token || !edit) return;

    const limit = Number(edit.limit);
    const validTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1440) {
      Alert.alert('حد غير صالح', 'أدخل عدد دقائق من 1 إلى 1440.');
      return;
    }
    if (!validTime(edit.start) || !validTime(edit.end)) {
      Alert.alert('وقت غير صالح', 'استخدم صيغة 24 ساعة، مثل 21:00 و07:00.');
      return;
    }

    setSaving(rule.child_account_id);
    setError('');
    try {
      const response = await fetch(
        `${API}/api/parent/usage-rules/${encodeURIComponent(rule.child_account_id)}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dailyLimitMinutes: limit,
            bedtimeStart: edit.start,
            bedtimeEnd: edit.end,
            timezone: edit.timezone.trim() || 'Africa/Algiers',
            enabled: edit.enabled,
          }),
        },
      );
      await json(response);
      guardRef.current?.push();
      await load(token);
      Alert.alert('تم الحفظ', `تم حفظ قواعد ${rule.child_username}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر حفظ القواعد.');
    } finally {
      setSaving('');
    }
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken('');
    setAccountName('');
    setDevices([]);
    setRules([]);
    setEdits({});
    setError('');
  };

  const field = (label: string, value: string, onChangeText: (v: string) => void,
    keyboardType?: 'default' | 'number-pad') => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType || 'default'}
        placeholderTextColor="#94a3b8"
        autoCapitalize="none"
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الرقابة الأبوية</Text>
        {token
          ? <TouchableOpacity onPress={logout}><Text style={styles.logout}>خروج</Text></TouchableOpacity>
          : <View style={{ width: 35 }} />}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#60a5fa" />
          <Text style={styles.muted}>جارٍ تحميل البيانات…</Text>
        </View>
      ) : !token ? (
        <ScrollView contentContainerStyle={styles.login}>
          <Text style={styles.emoji}>👨‍👩‍👧</Text>
          <Text style={styles.title}>دخول وليّ الأمر</Text>
          {field('رقم العائلة (familyId)', familyId, setFamilyId)}
          {field('اسم المستخدم', username, setUsername)}
          <Text style={styles.label}>كلمة المرور</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="كلمة المرور"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity style={styles.button} onPress={login} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> :
              <Text style={styles.buttonText}>تسجيل الدخول</Text>}
          </TouchableOpacity>
          <Text style={styles.muted}>يُحفظ رمز الدخول في التخزين الآمن للجهاز.</Text>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>مرحبًا {accountName || 'بوليّ الأمر'}</Text>
          <Text style={styles.muted}>الأجهزة المرتبطة بالحساب</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.heading}>الأجهزة ({devices.length})</Text>
          {devices.length === 0
            ? <Text style={styles.muted}>لا توجد أجهزة مرتبطة حاليًا.</Text>
            : devices.map((d) => (
              <View key={d.id} style={styles.card}>
                <Text style={styles.cardTitle}>📱 {d.device_name}</Text>
                <Text style={styles.muted}>الطفل: {d.child_username || 'غير محدد'}</Text>
                <Text style={styles.muted}>النظام: {d.platform || 'غير معروف'}</Text>
                <Text style={styles.muted}>
                  آخر اتصال: {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : 'غير متوفر'}
                </Text>
              </View>
            ))}

          <Text style={styles.heading}>قواعد الاستخدام</Text>
          {rules.length === 0
            ? <Text style={styles.muted}>لا توجد قواعد استخدام مسجلة.</Text>
            : rules.map((rule) => {
              const e = edits[rule.child_account_id];
              if (!e) return null;
              return (
                <View key={rule.child_account_id} style={styles.card}>
                  <Text style={styles.cardTitle}>👦 {rule.child_username}</Text>
                  <View style={styles.switchRow}>
                    <Text style={styles.label}>تفعيل القواعد</Text>
                    <Switch value={e.enabled}
                      onValueChange={(v) => change(rule.child_account_id, { enabled: v })} />
                  </View>
                  {field('الحد اليومي بالدقائق', e.limit,
                    (v) => change(rule.child_account_id, { limit: v.replace(/[^0-9]/g, '') }), 'number-pad')}
                  {field('بداية النوم (HH:MM)', e.start,
                    (v) => change(rule.child_account_id, { start: v }))}
                  {field('نهاية النوم (HH:MM)', e.end,
                    (v) => change(rule.child_account_id, { end: v }))}
                  {field('المنطقة الزمنية', e.timezone,
                    (v) => change(rule.child_account_id, { timezone: v }))}
                  <TouchableOpacity style={styles.button}
                    onPress={() => save(rule)} disabled={saving === rule.child_account_id}>
                    {saving === rule.child_account_id
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.buttonText}>حفظ القواعد</Text>}
                  </TouchableOpacity>
                </View>
              );
            })}
          <Text style={styles.warning}>
            تنبيه: تُطبَّق القواعد على تطبيق RabahDj في هاتف الطفل عند الاتصال المباشر. قد تتأخر المزامنة عند انقطاع الاتصال. قفل الهاتف كله وتطبيقات أخرى يتطلب وكيل النظام (dev build).
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b1220' },
  header: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#ffffff18' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  link: { color: '#93c5fd', fontWeight: '700', paddingVertical: 10 },
  logout: { color: '#fca5a5', fontWeight: '700', paddingVertical: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  login: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  content: { padding: 18, paddingBottom: 40 },
  emoji: { fontSize: 48, textAlign: 'center', marginBottom: 12 },
  title: { color: '#fff', fontSize: 23, fontWeight: '800', textAlign: 'center', marginVertical: 16 },
  heading: { color: '#e2e8f0', fontSize: 18, fontWeight: '800', marginTop: 22, marginBottom: 10 },
  label: { color: '#cbd5e1', fontWeight: '700', fontSize: 13 },
  field: { marginTop: 10 },
  input: { color: '#fff', backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 11, padding: 12, marginTop: 6 },
  button: { minHeight: 48, backgroundColor: '#2563eb', borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: 12, marginTop: 12 },
  buttonText: { color: '#fff', fontWeight: '800' },
  muted: { color: '#94a3b8', fontSize: 13, lineHeight: 20, marginTop: 5 },
  error: { color: '#fca5a5', backgroundColor: '#7f1d1d33', borderRadius: 10, padding: 10, marginVertical: 10 },
  card: { backgroundColor: '#111c30', borderWidth: 1, borderColor: '#334155', borderRadius: 14, padding: 14, marginBottom: 12 },
  cardTitle: { color: '#fff', fontWeight: '800', fontSize: 15, marginBottom: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  warning: { color: '#fbbf24', fontSize: 12, lineHeight: 19, marginTop: 18, padding: 12, backgroundColor: '#78350f33', borderRadius: 10 },
});
