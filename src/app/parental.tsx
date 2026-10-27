import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, 
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import ChildMap from '../components/child-map';
import { BASE_URL } from '../lib/config';
import { Image } from 'react-native';
// [stream-cmd] تحميل كسول لمكتبات الوسائط (لا كسر إن غابت أو تغيّرت واجهتها)
let createAudioPlayerFn: ((source: any) => any) | null = null;
let diagAudio = '';   // [stream-diag]
try {
  const m = require('expo-audio');
  createAudioPlayerFn = m.createAudioPlayer ?? null;
  diagAudio = m.createAudioPlayer ? 'ok' : 'createAudioPlayer غير موجود في expo-audio';
} catch (e: any) { diagAudio = 'فشل استيراد expo-audio: ' + String((e as any)?.message ?? String(e)); }
let FSmod: any = null;
let diagFS = '';     // [stream-diag]
try {
  try { FSmod = require('expo-file-system/legacy'); diagFS = 'legacy'; }
  catch { FSmod = require('expo-file-system'); diagFS = 'main'; }
  if (!FSmod?.writeAsStringAsync) diagFS += ' (تنبيه: writeAsStringAsync غير متاح!)';
  // [fs-probe] الواجهة الحقيقية تُعرض في الشريط:
  diagFS += ' | ' + JSON.stringify({
    write: typeof FSmod?.writeAsStringAsync,
    EncodingType: typeof FSmod?.EncodingType,
    Base64Val: FSmod?.EncodingType?.Base64 != null ? String(FSmod.EncodingType.Base64) : 'undef',
  });
} catch (e: any) { diagFS = 'فشل استيراد expo-file-system: ' + String((e as any)?.message ?? String(e)); }

const C = {
  bg: '#0b1220',
  card: '#111827',
  input: '#0d1626',
  border: '#1e293b',
  primary: '#2563eb',
  link: '#60a5fa',
  text: '#ffffff',
  label: '#e2e8f0',
  muted: '#94a3b8',
  danger: '#ef4444',
  success: '#10b981',
};

type Device = {
  id: number | string;
  device_name?: string;
  platform?: string;
  last_seen_at?: string;
  child_username?: string;
  last_lat?: number | null;
  last_lng?: number | null;
  last_location_at?: string | null;
};

type UsageRule = {
  child_account_id?: number;
  child_username?: string;
  daily_limit_minutes?: number;
  blocked_apps?: string[];
  bedtime_start?: string | null;
  bedtime_end?: string | null;
  enabled?: boolean;
};

export default function ParentalScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [pairingCode, setPairingCode] = useState('');
  const [pairingError, setPairingError] = useState('');
  const [isFetchingCode, setIsFetchingCode] = useState(false);

  const [devices, setDevices] = useState<Device[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<any[]>([]);
  const [isFetchingDevices, setIsFetchingDevices] = useState(false);

  const [usageRules, setUsageRules] = useState<UsageRule[]>([]);
  const [isFetchingRules, setIsFetchingRules] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [draftDailyLimit, setDraftDailyLimit] = useState('120');
  const [draftBedtimeStart, setDraftBedtimeStart] = useState('');
  const [draftBedtimeEnd, setDraftBedtimeEnd] = useState('');
  const [draftTimezone, setDraftTimezone] = useState('Africa/Algiers');
  const [draftEnabled, setDraftEnabled] = useState(true);
  const [draftBlockedApps, setDraftBlockedApps] = useState<string[]>([]);
  const [childAppsOptions, setChildAppsOptions] = useState<string[]>([]);
  const [draftNewPackage, setDraftNewPackage] = useState('');
  const [isSavingRule, setIsSavingRule] = useState(false);


    const [streamChildId, setStreamChildId] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSendingStreamCmd, setIsSendingStreamCmd] = useState(false);
  const [lastPhoto, setLastPhoto] = useState<string | null>(null);
  const [diagMsg, setDiagMsg] = useState<string | null>(null);
  const listenTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const listenCursor = useRef(0);
  const audioPlayer = useRef<any>(null);
  // [stream-cmd] استماع مباشر: يسحب WAV من الخادم كل ثانيتين ويعرض آخر لقطة
  const startListening = async () => {
    const cid = streamChildId ?? (usageRules[0] ? Number(usageRules[0].child_account_id) : null);
    if (!cid) {
      Alert.alert('تنبيه', 'لا يوجد حساب طفل للاستماع.');
      return;
    }
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) return;
      listenCursor.current = 0;
        setDiagMsg(`🧪 audio:${diagAudio || '?'} | fs:${diagFS || '?'} | ${FSmod?.documentDirectory ? 'docDir✔' : 'docDir✖'}`);
      setIsListening(true);
        try {
          const gm = require('../../modules/guard-module/src/GuardModule').default;
          const info = gm?.micDiag?.();
          if (info) setDiagMsg((m) => (m ? m + ' | 🎙️ ' + info : '🎙️ ' + info));
        } catch {}
      listenTimer.current = setInterval(() => {
        void (async () => {
          try {
            const r = await fetch(
              `${BASE_URL}/api/parent/stream/${cid}?since=${listenCursor.current}&withPhoto=1`,
              { headers: requestHeaders(token) },
            );
            const j = await r.json().catch(() => null);
            if (!r.ok || !j) return;
            if (typeof j.cursor === 'number') listenCursor.current = j.cursor;
            if (j.photo?.jpeg) setLastPhoto('data:image/jpeg;base64,' + j.photo.jpeg);
            if (j.wav) {
              setDiagMsg(`📥 وصل WAV: ${j.wav.length} حرفاً — جارٍ الكتابة والتشغيل`);
              try {
                const dir: string = (FSmod?.documentDirectory ?? FSmod?.cacheDirectory ?? '');
                if (!dir) return;
                const fileUri = dir + 'live_' + Date.now() + '.wav';   // [player-v3]
                const enc = (FSmod?.EncodingType?.Base64 != null)
                  ? FSmod.EncodingType.Base64
                  : 'base64';   // [fs-probe] safe fallback
                await FSmod.writeAsStringAsync(fileUri, j.wav, { encoding: enc });
                // أسماء صحيحة (remove/volume) + تشخيص حالة التشغيل الفعلية
                if (createAudioPlayerFn) {
                  try { audioPlayer.current?.remove?.(); } catch {}
                  try {
                    const p = createAudioPlayerFn(fileUri);
                    audioPlayer.current = p;
                    try { p.volume = 1.0; } catch {}
                    p.play?.();
                    setDiagMsg((m) => (m ? m + ' → ▶️ أُطلق' : '▶️ أُطلق'));
                    setTimeout(() => {
                      try {
                        setDiagMsg((m) => (m || '') + ` | ⏱ playing=${p.playing} dur=${p.duration ?? '?'} cur=${p.currentTime ?? '?'}`);
                      } catch {}
                    }, 600);
                  } catch (e2: any) {
                    setDiagMsg('❌ إنشاء/تشغيل المشغّل فشل: ' + String((e2 as any)?.message ?? e2));
                  }
                } else {
                  setDiagMsg('❌ createAudioPlayerFn غير متاح رغم diagAudio=ok — حالة غير متوقعة');
                }
              } catch (err) {
                console.warn('تشغيل الصوت المباشر:', err);
                setDiagMsg('❌ خطأ تشغيل: ' + String((err as any)?.message ?? String(err)));
              }
            }
          } catch (err) {
            console.warn('استماع:', err);
          }
        })();
      }, 2000);
    } catch (err) {
      console.warn('بدء الاستماع:', err);
    }
  };

  const stopListening = () => {
    if (listenTimer.current) {
      clearInterval(listenTimer.current);
      listenTimer.current = null;
    }
    try { audioPlayer.current?.release?.(); } catch {}
    audioPlayer.current = null;
    setIsListening(false);
    setLastPhoto(null);
  };

  const requestHeaders = (token: string) => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  });

  // ==== [usage-real] طبقة البيانات الحقيقية ====
  const [usageByDevice, setUsageByDevice] = useState<
    Record<string, { totalMinutes: number; serverTime: string }>
  >({});

  const formatDate = (iso?: string | null): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const pad = (x: number) => String(x).padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const fetchUsageForDevices = useCallback(
    async (list: Device[], token: string) => {
      try {
        const entries = await Promise.all(
          list.map(async (d) => {
            try {
              const r = await fetch(
                `${BASE_URL}/api/parent/usage/${d.id}?tz=Africa/Algiers`,
                { headers: requestHeaders(token) },
              );
              const data = await r.json().catch(() => null);
              const value =
                r.ok && data
                  ? {
                      totalMinutes: Number(data.totalMinutes) || 0,
                      serverTime: String(data.serverTime || ''),
                    }
                  : null;
              return [String(d.id), value] as const;
            } catch {
              return [String(d.id), null] as const;
            }
          }),
        );
        const map: Record<string, { totalMinutes: number; serverTime: string }> = {};
        for (const [id, v] of entries) if (v) map[id] = v;
        setUsageByDevice(map);
      } catch (error) {
        console.warn('تعذر تحميل بيانات الاستخدام:', error);
      }
    },
    [],
  );

  const sendCommand = useCallback(
    async (
      childAccountId: number,
      command: 'lock' | 'unlock' | 'add_minutes' | 'start_stream' | 'stop_stream',
      payload: Record<string, unknown> = {},
    ): Promise<boolean> => {
      try {
        const token = await SecureStore.getItemAsync('userToken');
        if (!token) return false;
        const r = await fetch(`${BASE_URL}/api/parent/commands`, {
          method: 'POST',
          headers: requestHeaders(token),
          body: JSON.stringify({ childAccountId, command, payload }),
        });
        return r.ok;
      } catch {
        return false;
      }
    },
    [],
  );


  // ==== نهاية [usage-real] ====

  const fetchLivePairingCode = useCallback(async (token: string) => {
    if (!token) return;

    setIsFetchingCode(true);
    setPairingError('');

    try {
      const response = await fetch(`${BASE_URL}/api/pairing/code`, {
        method: 'POST',
        headers: requestHeaders(token),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.code) {
        setPairingCode('');
        setPairingError(
          data?.error || data?.message || 'تعذر إنشاء رمز الاقتران.',
        );
        return;
      }

      setPairingCode(String(data.code));
    } catch {
      setPairingCode('');
      setPairingError('تعذر الاتصال بالخادم لإنشاء الرمز.');
    } finally {
      setIsFetchingCode(false);
    }
  }, []);

  const fetchLiveDevices = useCallback(async (token: string) => {
    setIsFetchingDevices(true);

    try {
      const response = await fetch(`${BASE_URL}/api/parent/devices`, {
        headers: requestHeaders(token),
      });
      const data = await response.json().catch(() => null);

      if (response.ok && Array.isArray(data?.devices)) {
        setDevices(data.devices);
        void fetchUsageForDevices(data.devices, token);
      } else if (!response.ok) {
        console.warn('تعذر تحميل الأجهزة:', data?.error || response.status);
      }
    } catch (error) {
      console.warn('خطأ تحميل الأجهزة:', error);
    } finally {
      setIsFetchingDevices(false);
    }
  }, []);

  const fetchLiveUsageRules = useCallback(async (token: string) => {
    setIsFetchingRules(true);

    try {
      const response = await fetch(`${BASE_URL}/api/parent/usage-rules`, {
        headers: requestHeaders(token),
      });
      const data = await response.json().catch(() => null);

      if (response.ok && Array.isArray(data?.usageRules)) {
        setUsageRules(data.usageRules);
      } else if (!response.ok) {
        console.warn('تعذر تحميل قواعد الاستخدام:', data?.error || response.status);
      }
    } catch (error) {
      console.warn('خطأ تحميل قواعد الاستخدام:', error);
    } finally {
      setIsFetchingRules(false);
    }
  }, []);

    const fetchLivePlaces = useCallback(async (token: string) => {
    try {
      const response = await fetch(BASE_URL + '/api/parent/places', {
        headers: requestHeaders(token),
      });
      const data = await response.json().catch(() => null);
      const list = Array.isArray(data) ? data : (data?.places || []);
      if (response.ok) setSavedPlaces(list);
    } catch (error) {
      console.warn('خطأ تحميل الأماكن المحفوظة:', error);
    }
  }, []);

const refreshDashboard = useCallback(async (token: string) => {
    await Promise.all([
      fetchLivePairingCode(token),
      fetchLiveDevices(token),
      fetchLiveUsageRules(token),
      fetchLivePlaces(token),
    ]);
  }, [fetchLivePairingCode, fetchLiveDevices, fetchLiveUsageRules, fetchLivePlaces]);

  // تحديث دوري كل 30 ثانية (يحافظ أيضاً على يقظة خادم Render)
  useEffect(() => {
    if (!isConfigured) return;
    const timer = setInterval(() => {
      void (async () => {
        const token = await SecureStore.getItemAsync('userToken');
        if (token) await refreshDashboard(token);
      })();
    }, 30_000);
    return () => clearInterval(timer);
  }, [isConfigured, refreshDashboard]);

  useEffect(() => {
    let active = true;

    async function loadCredentials() {
      try {
        const [savedUser, savedFamily, savedToken] = await Promise.all([
          SecureStore.getItemAsync('username'),
          SecureStore.getItemAsync('familyId'),
          SecureStore.getItemAsync('userToken'),
        ]);

        if (!active) return;

        if (savedUser && savedFamily && savedToken) {
          setUsername(savedUser);
          setFamilyId(savedFamily);
          setIsConfigured(true);
          await refreshDashboard(savedToken);
        }
      } catch (error) {
        console.warn('تعذر استرجاع جلسة ولي الأمر:', error);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadCredentials();

    return () => {
      active = false;
    };
  }, [refreshDashboard]);

  const handleRegister = async () => {
    if (!familyName.trim() || !username.trim() || !password) {
      Alert.alert('بيانات ناقصة', 'أدخل اسم العائلة واسم المستخدم وكلمة المرور.');
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familyName: familyName.trim(),
          username: username.trim(),
          password,
        }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.account?.familyId) {
        const newFamilyId = String(data.account.familyId);
        setFamilyId(newFamilyId);
        setPassword('');
        setIsRegistering(false);

        Alert.alert(
          'تم إنشاء العائلة',
          `رقم العائلة الخاص بك هو: ${newFamilyId}\nاحتفظ به، ثم سجّل الدخول باستخدامه.`,
        );
      } else {
        Alert.alert(
          'تعذر التسجيل',
          data?.error || data?.message || 'لم يتم إنشاء الحساب.',
        );
      }
    } catch {
      Alert.alert('خطأ في الاتصال', 'تعذر الوصول إلى خادم التسجيل.');
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
          password,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.token) {
        Alert.alert(
          'تعذر تسجيل الدخول',
          data?.error || data?.message || 'تحقق من بيانات الدخول.',
        );
        return;
      }

      await Promise.all([
        SecureStore.setItemAsync('userToken', data.token),
        SecureStore.setItemAsync('username', username.trim()),
        SecureStore.setItemAsync('familyId', familyId.trim()),
      ]);

      setPassword('');
      setIsConfigured(true);
      await refreshDashboard(data.token);
    } catch {
      Alert.alert('خطأ شبكي', 'تعذر الاتصال بالخادم.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      'تسجيل الخروج',
      'هل تريد تسجيل الخروج من حساب ولي الأمر على هذا الجهاز؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تسجيل الخروج',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all([
                SecureStore.deleteItemAsync('username'),
                SecureStore.deleteItemAsync('familyId'),
                SecureStore.deleteItemAsync('userToken'),
              ]);
              setUsername('');
              setPassword('');
              setFamilyId('');
              setPairingCode('');
              setPairingError('');
              setDevices([]);
              setUsageRules([]);
              setIsConfigured(false);
            } catch {
              Alert.alert('خطأ', 'تعذر إنهاء الجلسة بشكل صحيح.');
            }
          },
        },
      ],
    );
  };

  
  const fetchChildApps = useCallback(async (cid?: number | string | null) => {
    try {
      if (cid == null) return;
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) return;
      const r = await fetch(`${BASE_URL}/api/parent/child-apps/${encodeURIComponent(String(cid))}`, { headers: requestHeaders(token) });
      const d = await r.json().catch(() => null);
      const list = Array.isArray(d?.apps) ? d.apps : [];
      setChildAppsOptions(list);
      if (!list.length) Alert.alert('لا توجد بيانات', 'لم يرفع جهاز الطفل قائمة تطبيقاته بعد. افتح تطبيق الطفل مرة واحدة ثم أعد المحاولة.');
    } catch {
      Alert.alert('خطأ', 'تعذر جلب تطبيقات الطفل.');
    }
  }, []);

  const saveUsageRule = async (rule: UsageRule) => {
    const childId = rule.child_account_id;
    const dailyLimit = Number(draftDailyLimit.trim());
    const validTime = (value: string) =>
      value === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

    if (childId == null || !Number.isInteger(dailyLimit) ||
        dailyLimit < 0 || dailyLimit > 1440) {
      Alert.alert('بيانات غير صحيحة', 'أدخل حدًا يوميًا من 0 إلى 1440 دقيقة.');
      return;
    }
    if (!validTime(draftBedtimeStart) || !validTime(draftBedtimeEnd)) {
      Alert.alert('وقت غير صحيح', 'أدخل الوقت بصيغة HH:MM، مثل 22:30.');
      return;
    }
    if (!draftTimezone.trim()) {
      Alert.alert('بيانات ناقصة', 'أدخل المنطقة الزمنية.');
      return;
    }

    const token = await SecureStore.getItemAsync('userToken');
    if (!token) {
      Alert.alert('انتهت الجلسة', 'سجّل الدخول مجددًا.');
      return;
    }

    setIsSavingRule(true);
    try {
      const response = await fetch(
        `${BASE_URL}/api/parent/usage-rules/${encodeURIComponent(String(childId))}`,
        {
          method: 'PUT',
          headers: requestHeaders(token),
          body: JSON.stringify({
            dailyLimitMinutes: dailyLimit,
            bedtimeStart: draftBedtimeStart || null,
            bedtimeEnd: draftBedtimeEnd || null,
            timezone: draftTimezone.trim(),
            enabled: draftEnabled,
          }),
        },
      );
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        Alert.alert('تعذر حفظ القواعد', data?.error || data?.message || `HTTP ${response.status}`);
        return;
      }

      await fetchLiveUsageRules(token);
            // [blockapps-ui] حفظ قائمة الحظر مع القواعد
      try {
        const br = await fetch(`${BASE_URL}/api/parent/blocked-apps/${encodeURIComponent(String(childId))}`, {
          method: 'PUT',
          headers: requestHeaders(token),
          body: JSON.stringify({ apps: draftBlockedApps }),
        });
        if (!br.ok) {
          const bd = await br.json().catch(() => null);
          Alert.alert('تنبيه', 'حُفظت القواعد لكن تعذر حفظ قائمة الحظر: ' + (bd?.error || br.status));
        }
      } catch {}
setEditingRuleId(null);
      Alert.alert('تم الحفظ', 'استلم الخادم قواعد الاستخدام الجديدة.');
    } catch {
      Alert.alert('خطأ في الاتصال', 'تعذر حفظ القواعد. تحقق من اتصال الخادم.');
    } finally {
      setIsSavingRule(false);
    }
  };

  // [stream-cmd] الأوامر تُرسل إلى جهاز الطفل عبر sendCommand — لا بث محلي على هاتف الوالد
  const sendStreamCommand = async (command: 'start_stream' | 'stop_stream', mode: 'audio' | 'camera') => {
    const cid = streamChildId ?? (usageRules[0] ? Number(usageRules[0].child_account_id) : null);
    if (!cid) {
      Alert.alert('تنبيه', 'لا يوجد حساب طفل — أنشئ قاعدة استخدام أولاً.');
      return;
    }
    try {
      setIsSendingStreamCmd(true);
      const ok = await sendCommand(Number(cid), command, { mode });
      Alert.alert(
        ok ? 'تم الإرسال' : 'تعذر الإرسال',
        ok
          ? command === 'start_stream'
            ? 'يبدأ جهاز الطفل البث الآن.'
            : 'أُوقف البث على جهاز الطفل.'
          : 'تحقق من اتصال الخادم.',
      );
    } finally {
      setIsSendingStreamCmd(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.center]}>
        <ActivityIndicator size="large" color={C.link} />
        <Text style={styles.mutedText}>جارٍ تحميل الحساب...</Text>
      </SafeAreaView>
    );
  }

  if (!isConfigured) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formContainer}>
            <Text style={styles.title}>
              {isRegistering ? 'إنشاء حساب عائلة 👨‍👩‍👧' : 'دخول ولي الأمر 🔒'}
            </Text>

            {isRegistering ? (
              <>
                <Text style={styles.label}>اسم العائلة</Text>
                <TextInput
                  style={styles.input}
                  value={familyName}
                  onChangeText={setFamilyName}
                  placeholder="مثال: عائلة رباح"
                  placeholderTextColor={C.muted}
                  autoCapitalize="words"
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>رقم العائلة (Family ID)</Text>
                <TextInput
                  style={styles.input}
                  value={familyId}
                  onChangeText={setFamilyId}
                  placeholder="أدخل رقم العائلة"
                  placeholderTextColor={C.muted}
                  keyboardType="numeric"
                />
              </>
            )}

            <Text style={styles.label}>اسم المستخدم لولي الأمر</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="اسم المستخدم"
              placeholderTextColor={C.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>كلمة المرور</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="أدخل كلمة المرور"
              placeholderTextColor={C.muted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && styles.pressed,
              ]}
              disabled={isLoading}
              onPress={isRegistering ? handleRegister : handleLogin}
            >
              <Text style={styles.primaryBtnText}>
                {isRegistering ? 'إنشاء حساب العائلة' : 'تسجيل الدخول'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setIsRegistering(value => !value)}
              style={styles.switchBtn}
            >
              <Text style={styles.switchText}>
                {isRegistering
                  ? 'لديك حساب؟ سجّل الدخول'
                  : 'ليس لديك حساب عائلة؟ أنشئ حسابًا'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={isFetchingDevices || isFetchingRules}
            onRefresh={async () => {
              const token = await SecureStore.getItemAsync('userToken');
              if (token) await refreshDashboard(token);
            }}
            tintColor={C.link}
          />
        }
      >
        <View style={styles.dashboardContainer}>
          <Text style={styles.dashTitle}>لوحة التحكم الأبوية</Text>

          <View style={styles.card}>
            <Text style={styles.cardText}>
              ولي الأمر: <Text style={styles.linkText}>{username}</Text>
            </Text>
            <Text style={styles.cardText}>
              رقم العائلة: <Text style={styles.successText}>{familyId}</Text>
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>🔑 رمز اقتران جهاز الطفل</Text>
            <Text style={styles.cardSubText}>
              أنشئ رمزًا من الخادم، ثم أدخله في جهاز الطفل لإكمال الربط.
            </Text>

            {isFetchingCode ? (
              <ActivityIndicator
                size="large"
                color={C.link}
                style={styles.loader}
              />
            ) : pairingError ? (
              <Text style={styles.errorText}>{pairingError}</Text>
            ) : (
              <Text selectable style={styles.roomCode}>
                {pairingCode || '--------'}
              </Text>
            )}

            <Pressable
              disabled={isFetchingCode}
              onPress={async () => {
                const token = await SecureStore.getItemAsync('userToken');
                if (!token) {
                  setPairingError('انتهت الجلسة. سجّل الدخول مجددًا.');
                  return;
                }
                await fetchLivePairingCode(token);
              }}
              style={({ pressed }) => [
                styles.primaryBtn,
                styles.actionBtn,
                (pressed || isFetchingCode) && styles.pressed,
              ]}
            >
              <Text style={styles.primaryBtnText}>
                {isFetchingCode ? 'جارٍ إنشاء الرمز...' : 'إنشاء رمز اقتران جديد 🔄'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>📱 أجهزة العائلة المرتبطة</Text>

            {isFetchingDevices && devices.length === 0 ? (
              <ActivityIndicator color={C.link} style={styles.loader} />
            ) : devices.length === 0 ? (
              <Text style={styles.mutedText}>
                لا توجد أجهزة مرتبطة يعرضها الخادم حاليًا. اربط جهاز الطفل باستخدام رمز الاقتران.
              </Text>
            ) : (
                devices.map((device: any, index: number) => (
                  <View key={String(device.id ?? index)} style={styles.deviceRow}>
                    <Text style={styles.cardText}>
                      {device.device_name || 'جهاز بدون اسم'}
                    </Text>
                    <Text style={styles.mutedText}>
                                                                                                      المستخدم: {device.child_username || 'غير محدد'}
                    </Text>
                    <Text style={styles.mutedText}>
                                                                                                              النظام: {device.platform || 'غير معروف'}
                    </Text>

                                                                                                             {/* قسم الـ GPS المدمج داخل الواجهة */}
                    {device.latitude && device.longitude ? (
                      <View style={{ marginTop: 8, backgroundColor: '#0f172a', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#334155' }}>
                        <Text style={{ color: '#4ade80', fontSize: 13, fontWeight: 'bold' }}>  
                                                                                                                               📍 موقع GPS الحالي:
                        </Text>
                        <Text style={{ color: '#e2e8f0', fontSize: 12, marginTop: 3 }}>
                                                                                                               خط العرض: {device.last_lat}
                        </Text>
                        <Text style={{ color: '#e2e8f0', fontSize: 12 }}>
                                                                                                               خط الطول: {device.last_lng}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.mutedText}>📍 موقع GPS: بانتظام إرسال الإحداثيات...</Text>
                    )}

                    {device.last_seen_at ? (
                      <Text style={styles.mutedText}>
                                                                                                               آخر اتصال: {formatDate(device.last_seen_at)}{'\n'}⏱️ اليوم: {usageByDevice[String(device.id)]?.totalMinutes ?? '—'} دقيقة
                      </Text>
                    ) : null}
{device.last_lat != null && device.last_lng != null ? (
                      <ChildMap
                        latitude={device.last_lat}
                        longitude={device.last_lng}
                        places={savedPlaces}
                        height={240}
                      />
                    ) : null}
                  </View>
                ))

            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>⏱️ قواعد الاستخدام</Text>

            {isFetchingRules && usageRules.length === 0 ? (
              <ActivityIndicator color={C.link} style={styles.loader} />
            ) : usageRules.length === 0 ? (
              <Text style={styles.mutedText}>
                لا توجد قواعد استخدام يعرضها الخادم حاليًا.
              </Text>
            ) : (
              usageRules.map((rule, index) => (
                <View
                  key={String(rule.child_account_id ?? index)}
                  style={styles.deviceRow}
                >
                  <Text style={styles.cardText}>
                    الطفل: {rule.child_username || 'غير محدد'}
                  </Text>
                  <Text style={styles.mutedText}>
                    الحد اليومي: {rule.daily_limit_minutes ?? 'غير محدد'} دقيقة
                  </Text>
                  <Text style={styles.mutedText}>
                    وقت النوم: {rule.bedtime_start || '--:--'} - {rule.bedtime_end || '--:--'}
                  </Text>
                  <Text
                    style={[
                      styles.cardText,
                      { color: rule.enabled ? C.success : C.danger },
                    ]}
                  >
                    {rule.enabled ? 'القواعد مفعّلة' : 'القواعد غير مفعّلة'}
                  </Text>

                  {/* [blockapps-ui] إدارة قائمة الحظر */}
                  {editingRuleId === String(rule.child_account_id) ? (
                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.mutedText}>
                        ⛔ التطبيقات المحظورة ({draftBlockedApps.length})
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
                        {draftBlockedApps.map((p) => (
                          <Pressable
                            key={p}
                            onPress={() => setDraftBlockedApps(draftBlockedApps.filter((x) => x !== p))}
                            style={{ backgroundColor: C.danger, borderRadius: 14, paddingVertical: 4, paddingHorizontal: 10, marginRight: 6, marginBottom: 6 }}
                          >
                            <Text style={{ color: '#ffffff', fontSize: 11 }}>✕ {p}</Text>
                          </Pressable>
                        ))}
                        {childAppsOptions
                          .filter((p) => !draftBlockedApps.includes(p))
                          .map((p) => (
                            <Pressable
                              key={p}
                              onPress={() => setDraftBlockedApps([...draftBlockedApps, p])}
                              style={{ backgroundColor: C.input, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 4, paddingHorizontal: 10, marginRight: 6, marginBottom: 6 }}
                            >
                              <Text style={{ color: C.muted, fontSize: 11 }}>+ {p}</Text>
                            </Pressable>
                          ))}
                      </View>
                                            {/* [blockapps-ui] إضافة حزمة يدوياً */}
                      <View style={{ flexDirection: 'row', marginTop: 8 }}>
                        <TextInput
                          value={draftNewPackage}
                          onChangeText={setDraftNewPackage}
                          placeholder="اسم الحزمة يدوياً: com.android.chrome"
                          placeholderTextColor={C.muted}
                          autoCapitalize="none"
                          style={{ flex: 1, backgroundColor: C.input, borderColor: C.border, borderWidth: 1, borderRadius: 8, color: C.text, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12 }}
                        />
                        <Pressable
                          onPress={() => {
                            const p = draftNewPackage.trim();
                            if (!p) return;
                            if (!draftBlockedApps.includes(p)) setDraftBlockedApps([...draftBlockedApps, p]);
                            setDraftNewPackage('');
                          }}
                          style={{ marginLeft: 8, backgroundColor: C.danger, borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' }}
                        >
                          <Text style={{ color: '#ffffff', fontSize: 12 }}>+ حظر</Text>
                        </Pressable>
                      </View>
<Pressable
                        onPress={() => void fetchChildApps(rule.child_account_id)}
                        style={[styles.primaryBtn, { marginTop: 8, paddingVertical: 8 }]}
                      >
                        <Text style={styles.primaryBtnText}>📥 جلب تطبيقات الطفل المثبتة</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  
                  {/* [commands-ui] أزرار الأوامر الفورية */}
                  <View style={{ flexDirection: 'row', marginTop: 10 }}>
                    {[['lock', '🔒 قفل'], ['unlock', '🔓 فتح'], ['add_minutes', '+5 دقائق']].map(
                      ([cmd, label]) => (
                        <Pressable
                          key={cmd}
                          style={{
                            backgroundColor: cmd === 'lock' ? C.danger : C.primary,
                            paddingVertical: 8,
                            paddingHorizontal: 14,
                            borderRadius: 8,
                            marginRight: 8,
                          }}
                          onPress={() => {
                            void (async () => {
                              const cid = Number(rule.child_account_id);
                              if (!cid) {
                                Alert.alert('تنبيه', 'لا يوجد حساب طفل مرتبط بهذه القاعدة');
                                return;
                              }
                              const ok = await sendCommand(
                                cid,
                                cmd as 'lock' | 'unlock' | 'add_minutes',
                                cmd === 'add_minutes' ? { minutes: 5 } : {},
                              );
                              Alert.alert(
                                ok ? 'تم الإرسال' : 'تعذر الإرسال',
                                ok ? 'الأمر: ' + label : 'تحقق من الاتصال بالخادم',
                              );
                            })();
                          }}
                        >
                          <Text style={{ color: '#fff', fontSize: 12 }}>{label}</Text>
                        </Pressable>
                      ),
                    )}
                  </View>
<Pressable
                    style={[styles.primaryBtn, styles.actionBtn]}
                    onPress={() => {
                      setEditingRuleId(String(rule.child_account_id));
                      setDraftDailyLimit(String(rule.daily_limit_minutes ?? 120));
                      setDraftBedtimeStart(rule.bedtime_start || '');
                      setDraftBlockedApps(Array.isArray(rule.blocked_apps) ? rule.blocked_apps : []);
                      setChildAppsOptions([]);
                      void (async () => {
                        try {
                          const t2 = await SecureStore.getItemAsync('userToken');
                          if (!t2) return;
                          const r2 = await fetch(`${BASE_URL}/api/parent/blocked-apps/${encodeURIComponent(String(rule.child_account_id))}`, { headers: requestHeaders(t2) });
                          const d2 = await r2.json().catch(() => null);
                          if (r2.ok && Array.isArray(d2?.apps)) setDraftBlockedApps(d2.apps);
                        } catch {}
                      })();
                      setDraftBedtimeEnd(rule.bedtime_end || '');
                      setDraftTimezone('Africa/Algiers');
                      setDraftEnabled(rule.enabled !== false);
                    }}
                  >
                    <Text style={styles.primaryBtnText}>تعديل قواعد هذا الطفل</Text>
                  </Pressable>

                  {editingRuleId === String(rule.child_account_id) ? (
                    <View style={{ marginTop: 16 }}>
                      <Text style={styles.label}>الحد اليومي بالدقائق (0–1440)</Text>
                      <TextInput
                        style={styles.input}
                        value={draftDailyLimit}
                        onChangeText={setDraftDailyLimit}
                        keyboardType="number-pad"
                        placeholder="120"
                        placeholderTextColor={C.muted}
                      />

                      <Text style={styles.label}>بداية وقت النوم (HH:MM)</Text>
                      <TextInput
                        style={styles.input}
                        value={draftBedtimeStart}
                        onChangeText={setDraftBedtimeStart}
                        placeholder="22:00"
                        placeholderTextColor={C.muted}
                        autoCapitalize="none"
                      />

                      <Text style={styles.label}>نهاية وقت النوم (HH:MM)</Text>
                      <TextInput
                        style={styles.input}
                        value={draftBedtimeEnd}
                        onChangeText={setDraftBedtimeEnd}
                        placeholder="07:00"
                        placeholderTextColor={C.muted}
                        autoCapitalize="none"
                      />

                      <Text style={styles.label}>المنطقة الزمنية</Text>
                      <TextInput
                        style={styles.input}
                        value={draftTimezone}
                        onChangeText={setDraftTimezone}
                        placeholder="Africa/Algiers"
                        placeholderTextColor={C.muted}
                        autoCapitalize="none"
                      />

                      <Pressable
                        style={[styles.mediaBtn, draftEnabled ? styles.btnActive : styles.btnInactive]}
                        onPress={() => setDraftEnabled(value => !value)}
                      >
                        <Text style={styles.mediaBtnText}>
                          {draftEnabled ? 'القواعد مفعّلة — اضغط للتعطيل' : 'القواعد معطّلة — اضغط للتفعيل'}
                        </Text>
                      </Pressable>

                      <Pressable
                        style={[styles.primaryBtn, styles.actionBtn]}
                        disabled={isSavingRule}
                        onPress={() => saveUsageRule(rule)}
                      >
                        {isSavingRule ? (
                          <ActivityIndicator color={C.text} />
                        ) : (
                          <Text style={styles.primaryBtnText}>حفظ القواعد</Text>
                        )}
                      </Pressable>

                      <Pressable
                        style={styles.switchBtn}
                        onPress={() => setEditingRuleId(null)}
                      >
                        <Text style={styles.switchText}>إلغاء التعديل</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </View>

                    <View style={styles.card}>
            <Text style={styles.cardLabel}>🎥 البث عن بُعد (أوامر لجهاز الطفل)</Text>
            <Text style={styles.cardSubText}>
              الأزرار ترسل أوامر تُشغّل خدمة البث على جهاز الطفل نفسه. على Android 11+ يعمل البث بأفضل جودة حين يكون تطبيق الطفل مفتوحاً أو مستخدماً حديثاً.
            </Text>

            {usageRules.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                {usageRules.map((r) => {
                  const cid = Number(r.child_account_id);
                  const active = (streamChildId ?? Number(usageRules[0]?.child_account_id)) === cid;
                  return (
                    <Pressable
                      key={cid}
                      onPress={() => setStreamChildId(cid)}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 16,
                        marginRight: 8,
                        marginBottom: 6,
                        backgroundColor: active ? C.primary : C.input,
                        borderWidth: 1,
                        borderColor: active ? C.primary : C.border,
                      }}
                    >
                      <Text style={{ color: active ? '#ffffff' : C.muted, fontSize: 12 }}>
                        {r.child_username || 'طفل #' + cid}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.mutedText}>لا يوجد أطفال مرتبطون بعد.</Text>
            )}

            <View style={styles.mediaButtonsRow}>
              <Pressable
                disabled={isSendingStreamCmd}
                onPress={() => void sendStreamCommand('start_stream', 'camera')}
                style={[styles.mediaBtn, styles.btnActive]}
              >
                {isSendingStreamCmd ? (
                  <ActivityIndicator color={C.text} />
                ) : (
                  <Text style={styles.mediaBtnText}>📷 بث كاميرا + صوت</Text>
                )}
              </Pressable>

              <Pressable
                disabled={isSendingStreamCmd}
                onPress={() => void sendStreamCommand('start_stream', 'audio')}
                style={[styles.mediaBtn, styles.btnActive]}
              >
                <Text style={styles.mediaBtnText}>🎤 بث صوت فقط</Text>
              </Pressable>

              <Pressable
                disabled={isSendingStreamCmd}
                onPress={() => void sendStreamCommand('stop_stream', 'audio')}
                style={[styles.mediaBtn, styles.btnInactive]}
              >
                <Text style={styles.mediaBtnText}>⏹️ إيقاف البث</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => void (isListening ? stopListening() : startListening())}
              style={[styles.mediaBtn, isListening ? styles.btnActive : styles.btnInactive]}
            >
              <Text style={styles.mediaBtnText}>
                {isListening ? '⏹️ إيقاف الاستماع المباشر' : '🎧 استماع مباشر'}
              </Text>
            </Pressable>
            {isListening ? (
              <Text style={styles.mutedText}>جارٍ استقبال الصوت كل ثانيتين…</Text>
            ) : null}

            {isListening && diagMsg ? (
              <Text style={{ color: C.link, fontSize: 11, marginTop: 6 }} selectable>
                {diagMsg}
              </Text>
            ) : null}
            {lastPhoto ? (
              <Image
                source={{ uri: lastPhoto }}
                style={{ width: '100%', height: 220, borderRadius: 10, marginTop: 10, backgroundColor: '#000000' }}
                resizeMode="contain"
              />
            ) : null}
          </View>

          <Pressable
            onPress={handleReset}
            style={({ pressed }) => [
              styles.dangerBtn,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryBtnText}>تسجيل الخروج</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  container: { flexGrow: 1, backgroundColor: C.bg, padding: 20 },
  center: { alignItems: 'center', justifyContent: 'center' },
  formContainer: {
    backgroundColor: C.card,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 20,
  },
  dashboardContainer: { width: '100%' },
  title: {
    fontSize: 22,
    color: C.text,
    textAlign: 'center',
    marginBottom: 25,
    fontWeight: 'bold',
  },
  dashTitle: {
    fontSize: 24,
    color: C.text,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: 'bold',
  },
  label: {
    color: C.label,
    fontSize: 14,
    marginBottom: 7,
    fontWeight: '600',
    textAlign: 'right',
  },
  input: {
    backgroundColor: C.input,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    fontSize: 16,
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
    textAlign: 'right',
  },
  primaryBtn: {
    backgroundColor: C.primary,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: { marginTop: 12 },
  primaryBtnText: { color: C.text, fontSize: 15, fontWeight: 'bold' },
  pressed: { opacity: 0.7 },
  switchBtn: { paddingVertical: 16 },
  switchText: { color: C.link, textAlign: 'center', fontSize: 14 },
  card: {
    backgroundColor: C.card,
    padding: 18,
    borderRadius: 16,
    marginTop: 15,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardText: {
    color: C.text,
    fontSize: 15,
    textAlign: 'right',
    marginBottom: 6,
  },
  linkText: { color: C.link, fontWeight: 'bold' },
  successText: { color: C.success, fontWeight: 'bold' },
  cardLabel: {
    color: C.link,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  cardSubText: {
    color: C.muted,
    fontSize: 13,
    marginTop: 8,
    marginBottom: 10,
    textAlign: 'right',
    lineHeight: 21,
  },
  roomCode: {
    fontSize: 34,
    color: C.success,
    letterSpacing: 6,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 14,
  },
  loader: { marginVertical: 16 },
  errorText: {
    color: C.danger,
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 12,
  },
  mutedText: {
    color: C.muted,
    fontSize: 13,
    textAlign: 'right',
    marginTop: 5,
    lineHeight: 20,
  },
  deviceRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  mediaButtonsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 8,
  },
  mediaBtn: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  btnInactive: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: C.border },
  btnActive: { backgroundColor: '#b91c1c' },
  mediaBtnText: {
    color: C.text,
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  dangerBtn: {
    backgroundColor: C.danger,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 24,
    marginBottom: 20,
  },
});
