const fs = require('fs');
const f = 'src/app/parental.tsx';
let s = fs.readFileSync(f, 'utf8');
const old = "setDiagMsg('❌ خطأ تشغيل: ' + String(err?.message || err));";
const neu = "setDiagMsg('❌ خطأ تشغيل: ' + String((err as any)?.message ?? String(err)));";
if (s.includes(neu)) { console.log('مثبت مسبقاً'); process.exit(0); }
if (!s.includes(old)) { console.error('FAIL: err line not found'); process.exit(1); }
s = s.replace(old, neu);
fs.writeFileSync(f, s);
console.log('OK: err?.message fixed');
