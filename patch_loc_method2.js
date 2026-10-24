const fs = require('fs');
const m = (process.argv[2] || '').trim();
if (!['PUT','POST','PATCH'].includes(m)) { console.error('❌ طريقة غير صالحة: ' + m); process.exit(1); }
const f = 'src/lib/guard-sync.ts';
let s = fs.readFileSync(f, 'utf8');
const re = /(api\('\/api\/child\/location'[\s\S]{0,120}?method: )'(?:POST|PUT|PATCH)'/;
if (!re.test(s)) { console.error('❌ لم أجد نداء الموقع — أرسل: grep -n -A5 "child/location" src/lib/guard-sync.ts'); process.exit(1); }
// استبدال بدالة: لا أنماط $ نصية إطلاقاً
s = s.replace(re, function(_match, g1) { return g1 + "'" + m + "'"; });
fs.writeFileSync(f, s);
console.log('✅ نداء الموقع في التطبيق صار ' + m);
