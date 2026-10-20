import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { BASE_URL } from './config';

const CRED_KEY = 'rabahdj_child_creds';
const POLL_MS = 30_000;

type ChildCreds = {
  familyId: string;
  username: string;
  password: string;
};

type AppUsage = {
  packageName: string;
  minutes: number;
};

type UsageRule = {
  daily_limit_minutes: number;
  bedtime_start: string | null;
  bedtime_end: string | null;
  timezone: string;
  enabled: boolean;
};

type LockState = {
  locked: boolean;
  reason: '' | 'bedtime' | 'limit' | 'manual';
  usedMinutes: number;
  hasAccess: boolean;
  needsAccess: boolean;
};

type NativeGuard = {
  hasUsageAccess(): boolean;
  openUsageSettings(): void;
  getTodayUsage(): Promise<AppUsage[]>;
  getInstalledApps(): Promise<string[]>;
  startRemoteStream(): Promise<void>;
  stopRemoteStream(): Promise<void>;
};

const INITIAL: LockState = {
  locked: false,
  reason: '',
  usedMinutes: 0,
  hasAccess: false,
  needsAccess: true,
};

let native: NativeGuard | null = null;
let accessToken: string | null = null;
let loginPromise: Promise<string> | null = null;

try {
  native = require('../../modules/guard-module/src/GuardModule')
    .default as NativeGuard;
} catch {
  native = null;
}

async function getCredentials(): Promise<ChildCreds | null> {
  const raw = await SecureStore.getItemAsync(CRED_KEY);
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as ChildCreds;
    if (
      !value.familyId ||
      !value.username ||
      !value.password
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export async function saveChildCredentials(
  credentials: ChildCreds,
): Promise<void> {
  await SecureStore.setItemAsync(
    CRED_KEY,
    JSON.stringify(credentials),
  );
  // [زيرو] تشغيل مستمع البث الفوري فور حفظ البيانات
  if(credentials?.familyId) { listenToRemoteStreamCommands(String(credentials.familyId)); }
  accessToken = null;
}

export async function clearChildCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(CRED_KEY);
  // [زيرو] تشغيل مستمع البث الفوري فور حفظ البيانات
  accessToken = null;
}

async function login(): Promise<string> {
  if (accessToken) return accessToken;
  if (loginPromise) return loginPromise;

  loginPromise = (async () => {
    const credentials = await getCredentials();
    if (!credentials) {
      throw new Error('بيانات ربط جهاز الطفل غير موجودة.');
    }

    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || typeof data?.token !== 'string') {
      throw new Error(
        data?.error || `فشل تسجيل دخول الطفل (HTTP ${response.status})`,
      );
    }

    accessToken = data.token;
    return data.token;
  })();

  try {
    return await loginPromise;
  } finally {
    loginPromise = null;
  }
}

async function api(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<Response> {
  const token = await login();

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401 && retry) {
  // [زيرو] تشغيل مستمع البث الفوري فور حفظ البيانات
    accessToken = null;
    return api(path, init, false);
  }

  return response;
}

async function fetchRules(): Promise<UsageRule | null> {
  const response = await api('/api/child/usage-rules');

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(`تعذر تحميل قواعد الاستخدام (${response.status})`);
  }

  const data = await response.json();
  return data?.rule ?? null;
}

function minutesSinceMidnight(value: string | null): number | null {
  if (!value) return null;

  const match = /^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function isBedtime(rule: UsageRule, now: Date): boolean {
  const start = minutesSinceMidnight(rule.bedtime_start);
  const end = minutesSinceMidnight(rule.bedtime_end);

  if (start === null || end === null || start === end) {
    return false;
  }

  let current: number;

  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: rule.timezone || 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);

    const hour = Number(parts.find(part => part.type === 'hour')?.value);
    const minute = Number(parts.find(part => part.type === 'minute')?.value);

    if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
      return false;
    }

    current = hour * 60 + minute;
  } catch {
    console.error('منطقة زمنية غير صالحة في قاعدة الاستخدام');
    return false;
  }

  if (start < end) {
    return current >= start && current < end;
  }

  return current >= start || current < end;
}
function evaluate(
  rule: UsageRule | null,
  usedMinutes: number,
  hasAccess: boolean,
): LockState {
  const state: LockState = {
    locked: false,
    reason: '',
    usedMinutes,
    hasAccess,
    needsAccess: !hasAccess,
  };

  if (!rule || rule.enabled === false) return state;

  if (isBedtime(rule, new Date())) {
    return { ...state, locked: true, reason: 'bedtime' };
  }

  const limit = Number(rule.daily_limit_minutes);

  if (
    hasAccess &&
    Number.isFinite(limit) &&
    limit >= 0 &&
    usedMinutes >= limit
  ) {
    return { ...state, locked: true, reason: 'limit' };
  }

  return state;
}

async function readUsage(): Promise<{
  hasAccess: boolean;
  usedMinutes: number;
}> {
  if (!native) {
    return { hasAccess: false, usedMinutes: 0 };
  }

  try {
    const hasAccess = native.hasUsageAccess();

    if (!hasAccess) {
      return { hasAccess: false, usedMinutes: 0 };
    }

    const usage = await native.getTodayUsage();
    const usedMinutes = usage.reduce((total, item) => {
      const minutes = Number(item.minutes);
      return total + (
        Number.isFinite(minutes) && minutes > 0 ? minutes : 0
      );
    }, 0);

    return { hasAccess: true, usedMinutes };
  } catch (error) {
    console.warn('تعذر قراءة استخدام الجهاز:', error);
    return { hasAccess: false, usedMinutes: 0 };
  }
}

async function runCheck(): Promise<LockState> {
  const credentials = await getCredentials();

  if (!credentials) return INITIAL;

  const usage = await readUsage();

  // نحتفظ بالقراءة المحلية حتى عند تعذر الشبكة،
  // لكن لا نخترع قاعدة جديدة عند فشل الخادم.
  const rule = await fetchRules();

  return evaluate(rule, usage.usedMinutes, usage.hasAccess);
}

export async function syncChildData(): Promise<void> {
  try {
    await runCheck();
  } catch (error) {
    console.warn('فشلت مزامنة بيانات الطفل:', error);
  }
}

export async function requestLocationPermission(): Promise<boolean> {
  try {
    const foreground =
      await Location.requestForegroundPermissionsAsync();

    if (foreground.status !== 'granted') return false;

    const background =
      await Location.requestBackgroundPermissionsAsync();

    return background.status === 'granted';
  } catch (error) {
    console.warn('تعذر طلب صلاحية الموقع:', error);
    return false;
  }
}

export function openUsageAccess(): void {
  try {
    if (!native) {
      console.warn('وحدة الحماية الأصلية غير متاحة.');
      return;
    }

    native.openUsageSettings();
  } catch (error) {
    console.warn('تعذر فتح إعدادات الوصول للاستخدام:', error);
  }
}

/**
 * واجهة البث الأصلية الحالية لا تستقبل streamId،
 * ولا يثبت تنفيذ الخدمة وجود نقل فعلي للصورة والصوت.
 * نرفض إعلان نجاح البث قبل دمج نقل وسائط حقيقي.
 */
export async function startRemoteStream(
  _streamId: string,
): Promise<void> {
  try {
    if (native) {
      console.log('[زيرو] جاري تشغيل بث موديول النظام الحقيقي...');
      await native.startRemoteStream();
    } else {
      console.warn('وحدة الحماية الأصلية غير متاحة.');
    }
  } catch (err) {
    console.error('فشل إقلاع البث:', err);
  }
}

export async function stopRemoteStream(): Promise<void> {
  if (!native) {
    throw new Error('وحدة الحماية الأصلية غير متاحة.');
  }

  await native.stopRemoteStream();
}

export function useGuard(): LockState & {
  syncNow: () => Promise<void>;
} {
  const [state, setState] = useState<LockState>(INITIAL);
  const busy = useRef(false);
  const mounted = useRef(true);

  const syncNow = useCallback(async () => {
    if (busy.current) return;

    busy.current = true;

    try {
      const next = await runCheck();
      if (mounted.current) setState(next);
    } catch (error) {
      // لا نغيّر حالة القفل إلى مفتوح بسبب خطأ في الشبكة.
      console.warn('فشل فحص الحماية:', error);
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;

    void syncNow();

    const timer = setInterval(() => {
      void syncNow();
    }, POLL_MS);

    const subscription = AppState.addEventListener(
      'change',
      (nextState) => {
        if (nextState === 'active') {
          void syncNow();
        }
      },
    );

    return () => {
      mounted.current = false;
      clearInterval(timer);
      subscription.remove();
    };
  }, [syncNow]);

  return { ...state, syncNow };
}

// [زيرو] تفعيل قنوات البث الفوري الحقيقي وربط موديول المراقبة عن بعد بالنظام
import { io } from 'socket.io-client';

let pollingInterval: any = null;
export function listenToRemoteStreamCommands(familyId: string) {
  if (pollingInterval) clearInterval(pollingInterval);
  console.log('[زيرو] بدء جلب الأوامر دورياً للعائلة:', familyId);
  pollingInterval = setInterval(async () => {
    try {
      if (!accessToken) return;
      const response = await fetch(`${BASE_URL}/api/commands`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (!response.ok) return;
      const data = await response.json();
      const commands = data?.commands || [];
      for (const cmd of commands) {
        if (cmd.type === 'start_stream' && native) {
          console.log('[زيرو] تنفيذ أمر تشغيل البث الحي...');
          await native.startRemoteStream();
          await fetch(`${BASE_URL}/api/commands/${cmd.id}/acknowledge`, { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}` } });
        } else if (cmd.type === 'stop_stream' && native) {
          console.log('[زيرو] تنفيذ أمر إيقاف البث الحي...');
          await native.stopRemoteStream();
          await fetch(`${BASE_URL}/api/commands/${cmd.id}/acknowledge`, { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}` } });
        }
      }
    } catch (err) {
      console.error('خطأ الاستدعاء الدوري:', err);
    }
  }, 5000);
}