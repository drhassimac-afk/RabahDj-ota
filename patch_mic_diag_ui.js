const fs = require('fs');
const f = 'src/app/parental.tsx';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('micInfo')) { console.log('مثبت مسبقاً'); process.exit(0); }
const slA = '      setIsListening(true);';
if (!s.includes(slA)) { console.error('FAIL: sl anchor'); process.exit(1); }
s = s.replace(slA, slA +
  "\n        try {\n" +
  "          const gm = require('../../modules/guard-module/src/GuardModule').default;\n" +
  "          const info = gm?.micDiag?.();\n" +
  "          if (info) setDiagMsg((m) => (m ? m + ' | 🎙️ ' + info : '🎙️ ' + info));\n" +
  "        } catch {}");
fs.writeFileSync(f, s);
console.log('OK: mic info in diag bar');
