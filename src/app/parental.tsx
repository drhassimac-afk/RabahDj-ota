import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, SafeAreaView, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Linking } from 'react-native';
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
  last_lat?: number | null;
  last_lng?: number | null;
  last_location_at?: string | null;
  child_username?: string;
};
type Place = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  radius_m: number;
};
type Edit = {
  limit: string;
  start: string;
  end: string;
  timezone: string;
  enabled: boolean;
};
type UsageInfo = {
  total: number;
  apps: { packageName: string; minutes: number }[];
  at: string;
};
type PairCode = { code: string; expiresAt: number };

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const isAuthError = (e: unknown) =>
  e instanceof ApiError && (e.status === 401 || e.status === 403);

async function json(response: Response): Promise<any> {
  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ApiError(
      `استجابة غير صالحة من الخادم (${response.status})`,
      response.status,
    );
  }
  if (!response.ok) {
    throw new ApiError(
      data?.message || data?.error || `HTTP ${response.status}`,
      response.status,
    );
  }
  return data;
}

const hhmm = (v?: string) => (v || '21:00').slice(0, 5);

export default function ParentalScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [accountName, setAccountName] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [usage, setUsage] = useState<Record<string, UsageInfo | null>>({});
  const [pairCode, setPairCode] = useState<PairCode | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [placeName, setPlaceName] = useState('');
  const [placeLat, setPlaceLat] = useState('');
  const [placeLng, setPlaceLng] = useState('');
  const [placeRadius, setPlaceRadius] = useState('150');
  const [placeBusy, setPlaceBusy] = useState(false);
  const [commandBusy, setCommandBusy] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async (auth: string) => {
    const headers = { Authorization: `Bearer ${auth}` };
    const [d, r, p] = await Promise.all([
      fetch(`${API}/api/parent/devices`, { headers }).then(json),
      fetch(`${API}/api/parent/usage-rules`, { headers }).then(json),
      fetch(`${API}/api/parent/places`, { headers }).then(json),
    ]);
    setPlaces(Array.isArray(p.places) ? p.places : []);
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

    const entries = await Promise.all(
      nextRules.map(async (item): Promise<[string, UsageInfo | null]> => {
        try {
          const res = await fetch(
            `${API}/api/parent/children/${encodeURIComponent(item.child_account_id)}/activity?limit=30`,
            { headers },
          );
          const a = await json(res);
          const list: any[] = Array.isArray(a.activities) ? a.activities : [];
          const hit = list.find((x) => x?.event === 'usage_report');
          if (!hit) return [item.child_account_id, null];
          return [item.child_account_id, {
            total: Number(hit.data?.totalMinutes ?? 0),
            apps: Array.isArray(hit.data?.apps) ? hit.data.apps.slice(0, 3) : [],
            at: hit.created_at,
          }];
        } catch {
          return [item.child_account_id, null];
        }
      }),
    );
    setUsage(Object.fromEntries(entries));
  }, []);

  const clearSession = useCallback(() => {
    setToken('');
    setAccountName('');
    setDevices([]);
    setRules([]);
    setEdits({});
    setUsage({});
    setPairCode(null);
    setPlaces([]);
  }, []);

  const addPlace = async () => {
    if (!token) return;
    const lat = Number(placeLat);
    const lng = Number(placeLng);
    const radius = Number(placeRadius);
    if (!placeName.trim()) {
      Alert.alert('اسم مطلوب', 'أدخل اسم المنطقة (مثل: البيت أو المدرسة).');
      return;
    }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      Alert.alert('إحداثيات غير صالحة', 'تحقق من خط العرض وخط الطول.');
      return;
    }
    if (!Number.isInteger(radius) || radius < 30 || radius > 5000) {
      Alert.alert('نصف قطر غير صالح', 'أدخل رقمًا بين 30 و5000 مترًا.');
      return;
    }
    setPlaceBusy(true);
    setError('');
    try {
      const response = await fetch(`${API}/api/parent/places`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: placeName.trim(), latitude: lat, longitude: lng, radiusM: radius }),
      });
      await json(response);
      setPlaceName('');
      setPlaceLat('');
      setPlaceLng('');
      setPlaceRadius('150');
      await load(token);
    } catch (e) {
      if (isAuthError(e)) await expire();
      else setError(e instanceof Error ? e.message : 'تعذر إضافة المنطقة.');
    } finally {
      setPlaceBusy(false);
    }
  };

  const sendCommand = async (childAccountId: string, command: 'lock' | 'unlock' | 'add_minutes', minutes?: number) => {
    if (!token) return;
    setCommandBusy(childAccountId + command);
    setError('');
    try {
      const response = await fetch(`${API}/api/parent/children/${encodeURIComponent(childAccountId)}/command`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, minutes }),
      });
      await json(response);
      Alert.alert(
        'تم الإرسال',
        'سيصل الأمر إلى هاتف الطفل خلال دقيقة تقريبًا عند توفر الاتصال.',
      );
    } catch (e) {
      if (isAuthError(e)) await expire();
      else setError(e instanceof Error ? e.message : 'تعذر إرسال الأمر.');
    } finally {
      setCommandBusy('');
    }
  };

  const removePlace = async (place: Place) => {
    if (!token) return;
    try {
      const response = await fetch(`${API}/api/parent/places/${place.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await json(response);
      await load(token);
    } catch (e) {
      if (isAuthError(e)) await expire();
      else setError(e instanceof Error ? e.message : 'تعذر حذف المنطقة.');
    }
  };

  // جلسة منتهية: احذف التوكن المحفوظ وارجع لشاشة الدخول
  const expire = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      // تجاهل
    }
    clearSession();
    setError('انتهت الجلسة، سجّل الدخول من جديد.');
  }, [clearSession]);

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
        if (!active) return;
        if (isAuthError(e)) {
          await expire();
        } else {
          setError(e instanceof Error ? e.message : 'تعذر الاتصال بالخادم.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [load, expire]);

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

  const refresh = async () => {
    if (!token) return;
    setRefreshing(true);
    setError('');
    try {
      await load(token);
    } catch (e) {
      if (isAuthError(e)) await expire();
      else setError(e instanceof Error ? e.message : 'تعذر التحديث.');
    } finally {
      setRefreshing(false);
    }
  };

  const makeCode = async () => {
    if (!token) return;
    setCodeBusy(true);
    setError('');
    try {
      const response = await fetch(`${API}/api/pairing/code`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await json(response);
      setPairCode({
        code: String(data.code),
        expiresAt: Date.now() + Number(data.expiresInSeconds || 600) * 1000,
      });
    } catch (e) {
      if (isAuthError(e)) await expire();
      else setError(e instanceof Error ? e.message : 'تعذر إنشاء الرمز.');
    } finally {
      setCodeBusy(false);
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
      await load(token);
      Alert.alert('تم الحفظ', `تم حفظ قواعد ${rule.child_username}.`);
    } catch (e) {
      if (isAuthError(e)) {
        await expire();
      } else {
        setError(e instanceof Error ? e.message : 'تعذر حفظ القواعد.');
      }
    } finally {
      setSaving('');
    }
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    clearSession();
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
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>🔗 ربط جهاز طفل جديد</Text>
            <Text style={styles.muted}>
              أنشئ رمزًا، ثم أدخله في «ربط جهاز الطفل» على هاتف الطفل. الرمز يعمل مرة واحدة فقط ولمدة 10 دقائق.
            </Text>
            {pairCode ? (
              <>
                <Text style={styles.code} selectable>{pairCode.code}</Text>
                <Text style={styles.muted}>
                  صالح حتى {new Date(pairCode.expiresAt).toLocaleTimeString()}
                </Text>
              </>
            ) : null}
            <TouchableOpacity style={styles.button} onPress={makeCode} disabled={codeBusy}>
              {codeBusy
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.buttonText}>إنشاء رمز ربط</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.secondary} onPress={refresh} disabled={refreshing}>
            {refreshing
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>تحديث البيانات</Text>}
          </TouchableOpacity>

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
                {d.last_lat != null && d.last_lng != null ? (
                  <>
                    <Text style={styles.muted}>
                      آخر موقع: {d.last_lat.toFixed(5)}, {d.last_lng.toFixed(5)}
                      {d.last_location_at ? ' — ' + new Date(d.last_location_at).toLocaleString() : ''}
                    </Text>
                    <TouchableOpacity onPress={() => Linking.openURL(`https://maps.google.com/?q=${d.last_lat},${d.last_lng}`)}>
                      <Text style={styles.link}>فتح في خرائط Google</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={styles.muted}>لا يوجد موقع مسجل بعد.</Text>
                )}
              </View>
            ))}

          <Text style={styles.heading}>المناطق المحفوظة ({places.length})</Text>
          <View style={styles.card}>
            {field('اسم المنطقة (مثل: البيت)', placeName, setPlaceName)}
            {field('خط العرض (latitude)', placeLat, setPlaceLat, 'number-pad')}
            {field('خط الطول (longitude)', placeLng, setPlaceLng, 'number-pad')}
            {field('نصف القطر بالمتر', placeRadius, setPlaceRadius, 'number-pad')}
            <Text style={styles.muted}>
              يمكنك نسخ الإحداثيات من تطبيق خرائط Google (اضغط مطولًا على الموقع).
            </Text>
            <TouchableOpacity style={styles.button} onPress={addPlace} disabled={placeBusy}>
              {placeBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>إضافة منطقة</Text>}
            </TouchableOpacity>
          </View>
          {places.map((p) => (
            <View key={p.id} style={styles.card}>
              <Text style={styles.cardTitle}>📍 {p.name}</Text>
              <Text style={styles.muted}>{p.latitude.toFixed(5)}, {p.longitude.toFixed(5)} — نصف قطر {p.radius_m} م</Text>
              <TouchableOpacity onPress={() => removePlace(p)}>
                <Text style={styles.logout}>حذف المنطقة</Text>
              </TouchableOpacity>
            </View>
          ))}

          <Text style={styles.heading}>قواعد الاستخدام</Text>
          {rules.length === 0
            ? <Text style={styles.muted}>لا توجد قواعد استخدام مسجلة.</Text>
            : rules.map((rule) => {
              const e = edits[rule.child_account_id];
              if (!e) return null;
              const u = usage[rule.child_account_id];
              return (
                <View key={rule.child_account_id} style={styles.card}>
                  <Text style={styles.cardTitle}> 👦 {rule.child_username}</Text>
                  <View style={styles.usageBox}>
                    {u ? (
                      <>
                        <Text style={styles.usageMain}>
                          آخر استخدام: {u.total} دقيقة اليوم
                        </Text>
                        {u.apps.map((a) => (
                          <Text key={a.packageName} style={styles.muted}>
                            {a.packageName}: {a.minutes} د
                          </Text>
                        ))}
                        <Text style={styles.muted}>
                          وصل في {new Date(u.at).toLocaleString()}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.muted}>
                        لم يصل أي تقرير استخدام بعد (يتطلب إذن الوصول إلى بيانات الاستخدام على هاتف الطفل).
                      </Text>
                    )}
                  </View>
                  <View style={styles.commandRow}>
                    <TouchableOpacity
                      style={styles.commandBtn}
                      onPress={() => sendCommand(rule.child_account_id, 'lock')}
                      disabled={commandBusy === rule.child_account_id + 'lock'}
                    >
                      {commandBusy === rule.child_account_id + 'lock'
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.buttonText}>🔒 قفل الآن</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.commandBtn, styles.commandBtnAlt]}
                      onPress={() => sendCommand(rule.child_account_id, 'unlock')}
                      disabled={commandBusy === rule.child_account_id + 'unlock'}
                    >
                      {commandBusy === rule.child_account_id + 'unlock'
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.buttonText}>🔓 فتح القفل</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.commandBtn, styles.commandBtnAlt]}
                      onPress={() => sendCommand(rule.child_account_id, 'add_minutes', 30)}
                      disabled={commandBusy === rule.child_account_id + 'add_minutes'}
                    >
                      {commandBusy === rule.child_account_id + 'add_minutes'
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.buttonText}>+30 دقيقة</Text>}
                    </TouchableOpacity>
                  </View>
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
            تنبيه: يصل القاعدة الجديدة إلى هاتف الطفل خلال 5 دقائق تقريبًا عند توفر الاتصال، ويقفل التطبيق عند تجاوز الحد أو في وقت النوم. الحد اليومي يحسب استخدام الهاتف كله.
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
  secondary: { minHeight: 44, backgroundColor: '#334155', borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: 10 },
  buttonText: { color: '#fff', fontWeight: '800' },
  muted: { color: '#94a3b8', fontSize: 13, lineHeight: 20, marginTop: 5 },
  error: { color: '#fca5a5', backgroundColor: '#7f1d1d33', borderRadius: 10, padding: 10, marginVertical: 10 },
  card: { backgroundColor: '#111c30', borderWidth: 1, borderColor: '#334155', borderRadius: 14, padding: 14, marginBottom: 12 },
  cardTitle: { color: '#fff', fontWeight: '800', fontSize: 15, marginBottom: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  commandRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  commandBtn: { flex: 1, minHeight: 42, backgroundColor: '#dc2626', borderRadius: 10, alignItems: 'center', justifyContent: 'center', padding: 8 },
  commandBtnAlt: { backgroundColor: '#334155' },
  code: { color: '#60a5fa', fontSize: 36, fontWeight: '800', letterSpacing: 6, textAlign: 'center', marginTop: 14 },
  usageBox: { backgroundColor: '#0f172a', borderRadius: 10, padding: 10, marginBottom: 4 },
  usageMain: { color: '#e2e8f0', fontWeight: '700', fontSize: 14 },
  warning: { color: '#fbbf24', fontSize: 12, lineHeight: 19, marginTop: 18, padding: 12, backgroundColor: '#78350f33', borderRadius: 10 },
});
