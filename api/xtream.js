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


// أول برنامج حالي/قادم لقناة معيّنة (EPG قصير)
export async function getShortEpg(creds, streamId, limit = 1) {
  const res = await fetch(
    apiUrl(creds, 'get_short_epg', `&stream_id=${encodeURIComponent(streamId)}&limit=${limit}`)
  );

  if (!res.ok) {
    throw new Error('فشل جلب برنامج القناة');
  }

  return res.json();
}

// فك ترميز نصوص EPG (Xtream يرجعها بصيغة base64)
export function decodeBase64Text(str) {
  if (!str) return '';
  try {
    if (typeof atob === 'function') {
      return decodeURIComponent(escape(atob(str)));
    }
  } catch {
    // نكمل للطريقة اليدوية
  }

  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  const clean = str.replace(/[^A-Za-z0-9+/=]/g, '');
  let i = 0;
  while (i < clean.length) {
    const enc1 = chars.indexOf(clean.charAt(i++));
    const enc2 = chars.indexOf(clean.charAt(i++));
    const enc3 = chars.indexOf(clean.charAt(i++));
    const enc4 = chars.indexOf(clean.charAt(i++));
    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;
    output += String.fromCharCode(chr1);
    if (enc3 !== 64 && enc3 !== -1) output += String.fromCharCode(chr2);
    if (enc4 !== 64 && enc4 !== -1) output += String.fromCharCode(chr3);
  }
  try {
    return decodeURIComponent(escape(output));
  } catch {
    return output;
  }
}

// رابط تشغيل فيلم VOD
export function getVodStreamUrl({ server, username, password }, vodId, ext = 'mp4') {
  const base = server.replace(/\/+$/, '');

  return `${base}/movie/${encodeURIComponent(username)}/${encodeURIComponent(
    password
  )}/${encodeURIComponent(vodId)}.${ext}`;
}
