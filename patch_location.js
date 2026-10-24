const fs = require('fs');
const f = 'src/lib/guard-sync.ts';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('reportLocationNow')) { console.log('مثبت مسبقاً'); process.exit(0); }

const fn = `async function reportLocationNow(): Promise<void> {
  try {
    // requestLocationPermission موجودة أصلاً بهذا الملف (foreground + background)
    const ok = await requestLocationPermission();
    if (!ok) return;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    if (
      typeof pos?.coords?.latitude !== 'number' ||
      typeof pos?.coords?.longitude !== 'number'
    )
      return;
    await api('/api/child/location', {
      method: 'POST',
      body: JSON.stringify({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      }),
    });
  } catch (error) {
    console.warn('تعذر رفع الموقع:', error);
  }
}

`;
const anchor = 'async function runCheck(): Promise<LockState> {';
const call  = '  const usage = await readUsage();';
if (!s.includes(anchor) || !s.includes(call)) {
  console.error('❌ anchors غير موجودة — أرسل: grep -n "runCheck\\|readUsage" src/lib/guard-sync.ts');
  process.exit(0);
}
s = s.replace(anchor, fn + anchor);
s = s.replace(call, call + '\n  void reportLocationNow();   // [location] رفع الموقع مع كل فحص (كل 30 ثانية)');
fs.writeFileSync(f, s);
console.log('✅ guard-sync.ts: reportLocationNow + استدعاؤها في runCheck');
