import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';

const API = 'https://rabahdj-parental-backend.onrender.com';
const CRED_KEY = 'rabahdj_child_creds';
const RULE_KEY = 'rabahdj_child_rule';
const PLACES_KEY = 'rabahdj_child_places';
const GEO_STATE_KEY = 'rabahdj_child_geo_state';
const FORCE_LOCK_KEY = 'rabahdj_child_force_lock';
const EXTRA_MINUTES_KEY = 'rabahdj_child_extra_minutes';
const KNOWN_APPS_KEY = 'rabahdj_child_known_apps';

type AppUsage = { packageName: string; minutes: number };
type Native = {
  hasUsageAccess(): boolean;
  openUsageSettings(): void;
  getTodayUsage(): Promise<AppUsage[]>;
  getInstalledApps(): Promise<string[]>;
};

let native: Native | null = null;
try {
  native = require('../../modules/guard-module/src/GuardModule').default;
} catch {
  native = null;
}

export type ChildCreds = { familyId: string; username: string; password: string };
export type ChildRule = {
  daily_limit_minutes: number;
  bedtime_start: string | null;
  bedtime_end: string | null;
  timezone?: string;
  enabled: boolean;
};
export type LockState = {
  locked: boolean;
  reason: '' | 'limit' | 'bedtime' | 'manual';
  usedMinutes: number;
  needsAccess: boolean;
};
export type Place = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  radius_m: number;
};
type Usage = { hasAccess: boolean; apps: AppUsage[]; total: number };

const INITIAL: LockState = { locked: false, reason: '', usedMinutes: 0, needsAccess: false };

let token = '';

export async function saveChildCredentials(c: ChildCreds): Promise<void> {
  await SecureStore.setItemAsync(CRED_KEY, JSON.stringify(c));
  token = '';
}

export async function clearChildCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(CRED_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(RULE_KEY).catch(() => {});
  token = '';
}

export function openUsageAccess(): void {
  try {
    native?.openUsageSettings();
  } catch {
    // تجاهل
  }
}

async function login(): Promise<string> {
  const raw = await SecureStore.getItemAsync(CRED_KEY);
  if (!raw) throw new Error('no-credentials');
  const creds: ChildCreds = JSON.parse(raw);
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      familyId: creds.familyId,
      username: creds.username,
      password: creds.password,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.token) throw new Error('login-failed');
  token = data.token;
  return token;
}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const run = () =>
    fetch(`${API}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...((init.headers as Record<string, string>) || {}),
        Authorization: `Bearer ${token}`,
      },
    });
  if (!token) await login();
  let res = await run();
  if (res.status === 401) {
    await login();
    res = await run();
  }
  return res;
}

async function getCachedPlaces(): Promise<Place[]> {
  try {
    const raw = await SecureStore.getItemAsync(PLACES_KEY);
    return raw ? (JSON.parse(raw) as Place[]) : [];
  } catch {
    return [];
  }
}

async function syncPlaces(): Promise<void> {
  const res = await api('/api/child/places');
  if (!res.ok) return;
  const data = await res.json().catch(() => null);
  if (Array.isArray(data?.places)) {
    await SecureStore.setItemAsync(PLACES_KEY, JSON.stringify(data.places));
  }
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

async function trackLocation(): Promise<void> {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted') return;

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const { latitude, longitude } = pos.coords;

    await api('/api/child/location', {
      method: 'PUT',
      body: JSON.stringify({ latitude, longitude }),
    }).catch(() => {});

    const places = await getCachedPlaces();
    if (!places.length) return;

    let prevInside: Record<number, boolean> = {};
    try {
      const raw = await SecureStore.getItemAsync(GEO_STATE_KEY);
      prevInside = raw ? JSON.parse(raw) : {};
    } catch {
      prevInside = {};
    }

    const nextInside: Record<number, boolean> = {};
    for (const place of places) {
      const inside =
        distanceMeters(latitude, longitude, place.latitude, place.longitude) <= place.radius_m;
      nextInside[place.id] = inside;
      const was = prevInside[place.id] ?? false;
      if (inside && !was) {
        await api('/api/child/activity', {
          method: 'POST',
          body: JSON.stringify({ event: 'geofence_enter', data: { placeId: place.id, name: place.name } }),
        }).catch(() => {});
      } else if (!inside && was) {
        await api('/api/child/activity', {
          method: 'POST',
          body: JSON.stringify({ event: 'geofence_exit', data: { placeId: place.id, name: place.name } }),
        }).catch(() => {});
      }
    }
    await SecureStore.setItemAsync(GEO_STATE_KEY, JSON.stringify(nextInside)).catch(() => {});
  } catch {
    // تجاهل أخطاء الموقع، تُعاد المحاولة في الدورة التالية
  }
}

async function checkNewApps(): Promise<void> {
  if (!native) return;
  try {
    const current = await native.getInstalledApps();
    const raw = await SecureStore.getItemAsync(KNOWN_APPS_KEY);
    const known: string[] = raw ? JSON.parse(raw) : [];

    if (known.length > 0) {
      const knownSet = new Set(known);
      const newOnes = current.filter((p) => !knownSet.has(p));
      for (const pkg of newOnes) {
        await api('/api/child/activity', {
          method: 'POST',
          body: JSON.stringify({ event: 'app_installed', data: { packageName: pkg, at: new Date().toISOString() } }),
        }).catch(() => {});
      }
    }

    await SecureStore.setItemAsync(KNOWN_APPS_KEY, JSON.stringify(current)).catch(() => {});
  } catch {
    // تجاهل، تُعاد المحاولة في الدورة التالية
  }
}

export async function requestLocationPermission(): Promise<boolean> {
  try {
    const res = await Location.requestForegroundPermissionsAsync();
    return res.status === 'granted';
  } catch {
    return false;
  }
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

async function getForceLock(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(FORCE_LOCK_KEY)) === '1';
  } catch {
    return false;
  }
}

async function getExtraMinutesToday(): Promise<number> {
  try {
    const raw = await SecureStore.getItemAsync(EXTRA_MINUTES_KEY);
    if (!raw) return 0;
    const data = JSON.parse(raw) as { date: string; minutes: number };
    return data.date === todayKey() ? data.minutes : 0;
  } catch {
    return 0;
  }
}

async function addExtraMinutesToday(minutes: number): Promise<void> {
  const current = await getExtraMinutesToday();
  await SecureStore.setItemAsync(
    EXTRA_MINUTES_KEY,
    JSON.stringify({ date: todayKey(), minutes: current + minutes }),
  ).catch(() => {});
}

async function syncCommands(): Promise<void> {
  try {
    const res = await api('/api/child/commands');
    if (!res.ok) return;
    const commands = await res.json(); // يتوقع مصفوفة مثل: [{ action: "START_STREAM" }] أو STOP_STREAM
    
    if (Array.isArray(commands)) {
      for (const cmd of commands) {
        if (cmd.action === 'START_STREAM') {
          console.log('🎥 تم استقبال أمر تشغيل البث الحي للكاميرا والشاشة عن بعد...');
          // استدعاء دالة الأندرويد الأصيلة لتشغيل خدمة البث في الخلفية
          if (typeof GuardModule?.startRemoteStream === 'function') {
            await GuardModule.startRemoteStream();
          }
        } else if (cmd.action === 'STOP_STREAM') {
          console.log('🛑 تم استقبال أمر إيقاف البث الحي عن بعد...');
          if (typeof GuardModule?.stopRemoteStream === 'function') {
            await GuardModule.stopRemoteStream();
          }
        }
      }
    }
  } catch (err) {
    console.error('خطأ في مزامنة أوامر التحكم عن بعد:', err);
  }
}

async function getCachedRule(): Promise<ChildRule | null> {
  try {
    const raw = await SecureStore.getItemAsync(RULE_KEY);
    return raw ? (JSON.parse(raw) as ChildRule) : null;
  } catch {
    return null;
  }
}

async function syncRules(): Promise<void> {
  const res = await api('/api/child/usage-rules');
  if (res.status === 404) {
    await SecureStore.deleteItemAsync(RULE_KEY).catch(() => {});
    return;
  }
  if (!res.ok) return;
  const data = await res.json().catch(() => null);
  if (data?.rule) {
    await SecureStore.setItemAsync(RULE_KEY, JSON.stringify(data.rule));
  }
}

async function readUsage(): Promise<Usage> {
  const none: Usage = { hasAccess: false, apps: [], total: 0 };
  if (!native) return none;
  try {
    if (!native.hasUsageAccess()) return none;
    const apps = await native.getTodayUsage();
    return { hasAccess: true, apps, total: apps.reduce((s, a) => s + a.minutes, 0) };
  } catch {
    return none;
  }
}

async function reportUsage(u: Usage): Promise<void> {
  if (!u.hasAccess) return;
  await api('/api/child/activity', {
    method: 'POST',
    body: JSON.stringify({
      event: 'usage_report',
      data: {
        totalMinutes: u.total,
        apps: u.apps.slice(0, 8),
        at: new Date().toISOString(),
      },
    }),
  });
}

function toMinutes(v: string): number {
  const [h, m] = v.split(':');
  return Number(h) * 60 + Number(m);
}

function nowMinutes(tz?: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz || undefined,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === 'hour')?.value) % 24;
    const m = Number(parts.find((p) => p.type === 'minute')?.value);
    if (Number.isFinite(h) && Number.isFinite(m)) return h * 60 + m;
  } catch {
    // نرجع لوقت الجهاز
  }
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function evaluate(
  rule: ChildRule | null,
  u: Usage,
  forceLock: boolean,
  extraMinutes: number,
): LockState {
  if (forceLock) {
    return { locked: true, reason: 'manual', usedMinutes: u.total, needsAccess: !u.hasAccess };
  }

  if (!rule || !rule.enabled) return { ...INITIAL, usedMinutes: u.total };

  if (rule.bedtime_start && rule.bedtime_end) {
    const now = nowMinutes(rule.timezone);
    const s = toMinutes(rule.bedtime_start);
    const e = toMinutes(rule.bedtime_end);
    const inBed = s > e ? now >= s || now < e : now >= s && now < e;
    if (inBed) {
      return { locked: true, reason: 'bedtime', usedMinutes: u.total, needsAccess: !u.hasAccess };
    }
  }

  if (u.hasAccess && u.total >= rule.daily_limit_minutes + extraMinutes) {
    return { locked: true, reason: 'limit', usedMinutes: u.total, needsAccess: false };
  }

  return { locked: false, reason: '', usedMinutes: u.total, needsAccess: !u.hasAccess };
}

export function useGuard(): LockState {
  const [state, setState] = useState<LockState>(INITIAL);

  useEffect(() => {
    let alive = true;
    let tick = 0;

    const run = async () => {
      try {
        const creds = await SecureStore.getItemAsync(CRED_KEY);
        if (!creds) {
          if (alive) setState(INITIAL);
          return;
        }
        await syncCommands().catch(() => {});
        if (tick % 5 === 0) await syncRules().catch(() => {});
        if (tick % 5 === 0) await syncPlaces().catch(() => {});
        if (tick % 15 === 0) await trackLocation().catch(() => {});
        if (tick % 15 === 0) await checkNewApps().catch(() => {});
        const rule = await getCachedRule();
        const usage = await readUsage();
        if (tick % 10 === 0) reportUsage(usage).catch(() => {});
        const forceLock = await getForceLock();
        const extraMinutes = await getExtraMinutesToday();
        if (alive) setState(evaluate(rule, usage, forceLock, extraMinutes));
        tick++;
      } catch {
        // تجاهل، تُعاد المحاولة في الدورة التالية
      }
    };

    run();
    const id = setInterval(run, 60000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') run();
    });
    return () => {
      alive = false;
      clearInterval(id);
      sub.remove();
    };
  }, []);

  return state;
}
