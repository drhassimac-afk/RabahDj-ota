const fs = require('fs');
const f = 'modules/guard-module/android/src/main/java/com/rabahdj/app/guard/GuardModule.kt';
let s = fs.readFileSync(f, 'utf8');

const OLD = '      val ctx = appContext.reactContext ?: return "no-context"';
if (!s.includes(OLD)) { console.error('FAIL: anchor not found — أرسل sed -n حول السطر 47-48'); process.exit(1); }

const NEW = '      val ctx = appContext.reactContext ?: return@Function "no-context"';
s = s.replace(OLD, NEW);
fs.writeFileSync(f, s);
console.log('OK: return@Function fix applied');
