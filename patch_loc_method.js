const fs = require('fs');
const m = fs.readFileSync(process.env.HOME + '/loc_method.txt', 'utf8').trim();
if (!['PUT','POST','PATCH'].includes(m)) { console.error('❌ طريقة غير معروفة: ' + m); process.exit(0); }
const f = 'src/lib/guard-sync.ts';
let s = fs.readFileSync(f, 'utf8');
const re = /(api\('\/api\/child\/location'[\s\S]{0,120}?method: )'(?:POST|PUT|PATCH)'/;
if (!re.test(s)) { console.error('❌ لم أجد نداء الموقع — أرسل: grep -n -A5 "child/location" src/lib/guard-sync.ts'); process.exit(0); }
s = s.replace(re, "$1'" + m + "'");
fs.writeFileSync(f, s);
console.log('✅ نداء الموقع في التطبيق صار ' + m + ' ليطابق الخادم');
