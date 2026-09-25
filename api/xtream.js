// api/xtream.js
// تواصل مع سيرفر Xtream Codes
// بيانات الدخول تُقرأ من AsyncStorage بدل ما تكون ثابتة بالكود

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'iptv_credentials';

// حفظ بيانات الدخول
export async function saveCredentials({ server, username, password }) {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ server, username, password })
  );
}

// استرجاع بيانات الدخول
export async function getSavedCredentials() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

// حذف بيانات الدخول
export async function clearCredentials() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

function apiUrl({ server, username, password }, action = '', extraParams = '') {
  const base = server.replace(/\/+$/, '');

  return `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}${
    action ? `&action=${encodeURIComponent(action)}` : ''
  }${extraParams}`;
}

// تسجيل الدخول + معلومات الحساب
export async function login({ server, username, password }) {
  const res = await fetch(apiUrl({ server, username, password }));

  if (!res.ok) {
    throw new Error('تعذر الاتصال بالسيرفر');
  }

  const data = await res.json();

  if (!data?.user_info || data.user_info.auth !== 1) {
    throw new Error('بيانات الدخول غير صحيحة');
  }

  return data;
}

// فئات القنوات المباشرة
export async function getLiveCategories(creds) {
  const res = await fetch(apiUrl(creds, 'get_live_categories'));

  if (!res.ok) {
    throw new Error('فشل جلب الفئات');
  }

  return res.json();
}

// القنوات المباشرة
export async function getLiveStreams(creds, categoryId) {
  const res = await fetch(
    apiUrl(
      creds,
      'get_live_streams',
      `&category_id=${encodeURIComponent(categoryId)}`
    )
  );

  if (!res.ok) {
    throw new Error('فشل جلب القنوات');
  }

  return res.json();
}

// رابط تشغيل القناة
export function getStreamUrl(
  { server, username, password },
  streamId,
  ext = 'm3u8'
) {
  const base = server.replace(/\/+$/, '');

  return `${base}/live/${encodeURIComponent(username)}/${encodeURIComponent(
    password
  )}/${encodeURIComponent(streamId)}.${ext}`;
}

// فئات VOD
export async function getVodCategories(creds) {
  const res = await fetch(apiUrl(creds, 'get_vod_categories'));

  if (!res.ok) {
    throw new Error('فشل جلب فئات VOD');
  }

  return res.json();
}

// أفلام VOD
export async function getVodStreams(creds, categoryId) {
  const res = await fetch(
    apiUrl(
      creds,
      'get_vod_streams',
      `&category_id=${encodeURIComponent(categoryId)}`
    )
  );

  if (!res.ok) {
    throw new Error('فشل جلب أفلام VOD');
  }

  return res.json();
}
