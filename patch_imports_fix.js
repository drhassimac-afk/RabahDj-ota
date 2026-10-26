const fs = require('fs');
const f = 'modules/guard-module/android/src/main/java/com/rabahdj/app/guard/AppWatcherService.kt';
let s = fs.readFileSync(f, 'utf8');
const lines = s.split('\n');
let last = -1;
lines.forEach((l, i) => { if (/^import /.test(l)) last = i; });
const needed = [
  'import java.net.HttpURLConnection',
  'import java.net.URL',
  'import org.json.JSONObject',
];
let added = 0;
for (const imp of needed) {
  if (s.includes(imp)) continue;
  lines.splice(last + 1, 0, imp);
  last++;
  added++;
}
s = lines.join('\n');
fs.writeFileSync(f, s);
console.log('OK: ' + added + ' imports added');
