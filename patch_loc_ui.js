const fs = require('fs');
const f = 'src/app/parental.tsx';
let s = fs.readFileSync(f, 'utf8');

let changed = 0;
// الحقول الحقيقية من الخادم: last_lat / last_lng / last_location_at
const pairs = [
  ['{device.latitude}',  '{device.last_lat}'],
  ['{device.longitude}', '{device.last_lng}'],
];
for (const [a, b] of pairs) {
  if (s.includes(a)) { s = s.split(a).join(b); changed++; }
}
// تحسين نوع بيانات Device ليتطابق مع الخادم
if (!s.includes('last_lat?')) {
  s = s.replace(
    /type Device = \{([^}]*)\};/,
    (m) => m.replace('}', '  last_lat?: number | null;\n  last_lng?: number | null;\n  last_location_at?: string | null;\n}'),
  );
  changed++;
}
fs.writeFileSync(f, s);
console.log(changed ? `✅ parental.tsx: ${changed} إصلاحاً (الحقول + النوع)` : '↷ لا تغييرات needed');
