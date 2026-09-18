import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const KEY_USERNAME = 'rabahdj_admin_username';
const KEY_PASSHASH = 'rabahdj_admin_passhash';

const DEFAULT_USERNAME = 'Rabah';
const DEFAULT_PASSWORD = 'Rbh2605';

async function hash(text: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
}

async function ensureDefaults(): Promise<{ username: string; passHash: string }> {
  let username = await AsyncStorage.getItem(KEY_USERNAME);
  let passHash = await AsyncStorage.getItem(KEY_PASSHASH);

  if (!username || !passHash) {
    username = username || DEFAULT_USERNAME;
    passHash = passHash || (await hash(DEFAULT_PASSWORD));

    await AsyncStorage.setItem(KEY_USERNAME, username);
    await AsyncStorage.setItem(KEY_PASSHASH, passHash);
  }

  return { username, passHash };
}

export async function checkAdminLogin(user: string, pass: string): Promise<boolean> {
  const { username, passHash } = await ensureDefaults();
  const candidateHash = await hash(pass);

  return user === username && candidateHash === passHash;
}

export async function changeAdminCredentials(
  oldPass: string,
  newUsername: string,
  newPass: string
): Promise<{ ok: boolean; error?: string }> {
  const { passHash } = await ensureDefaults();
  const oldHash = await hash(oldPass);

  if (oldHash !== passHash) {
    return { ok: false, error: 'كلمة السر الحالية غير صحيحة' };
  }

  if (!newUsername.trim() || !newPass.trim()) {
    return { ok: false, error: 'يرجى تعبئة الحقول' };
  }

  if (newPass.length < 4) {
    return { ok: false, error: 'كلمة السر الجديدة قصيرة جدًا' };
  }

  await AsyncStorage.setItem(KEY_USERNAME, newUsername.trim());
  await AsyncStorage.setItem(KEY_PASSHASH, await hash(newPass));

  return { ok: true };
}
