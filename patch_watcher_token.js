const fs = require('fs');
const f = 'modules/guard-module/android/src/main/java/com/rabahdj/app/guard/AppWatcherService.kt';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('"SET_TOKEN"')) { console.log('مثبت مسبقاً'); process.exit(0); }
const a = 'intent?.getStringExtra("TOKEN")?.let { token = it }';
// الخدمة لا تملك token إلا في MediaStreaming — AppWatcher يستخدم childToken. أضف:
if (!s.includes('intent?.getStringExtra("TOKEN")')) {
  const onCreateEnd = 'override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {';
  if (!s.includes(onCreateEnd)) { console.error('FAIL: onStartCommand anchor'); process.exit(1); }
  s = s.replace(onCreateEnd, onCreateEnd +
    '\n    intent?.getStringExtra("TOKEN")?.let { setChildToken(it) }');
}
fs.writeFileSync(f, s);
console.log('OK: SET_TOKEN handling added');
