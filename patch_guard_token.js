const fs = require('fs');
const f = 'modules/guard-module/android/src/main/java/com/rabahdj/app/guard/GuardModule.kt';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('setChildToken')) { console.log('مثبت مسبقاً'); process.exit(0); }
const anchor = '    Function("startRemoteStream") { token: String ->';
if (!s.includes(anchor)) { console.error('FAIL: stream anchor'); process.exit(1); }
const add = [
  '    Function("setChildToken") { token: String ->',
  '      val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")',
  '      val intent = Intent(context, AppWatcherService::class.java)',
  '      if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent)',
  '      else context.startService(intent)',
  '      // التوكن يصل للخدمة عبر Intent extra في النداء التالي — نجبره الآن:',
  '      val i2 = Intent(context, AppWatcherService::class.java).apply { action = "SET_TOKEN"; putExtra("TOKEN", token) }',
  '      if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(i2) else context.startService(i2)',
  '      "token sent"',
  '    }',
  '',
].join('\n');
s = s.replace(anchor, add + anchor);
fs.writeFileSync(f, s);
console.log('OK: setChildToken added');
