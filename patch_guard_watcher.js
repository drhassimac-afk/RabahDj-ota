const fs = require('fs');
const f = 'modules/guard-module/android/src/main/java/com/rabahdj/app/guard/GuardModule.kt';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('setBlockedApps')) { console.log('مثبت مسبقاً'); process.exit(0); }
const anchor = '    AsyncFunction("getInstalledApps") {';
if (!s.includes(anchor)) { console.error('FAIL: getInstalledApps anchor'); process.exit(1); }
const block = [
  '    Function("setBlockedApps") { apps: List<String> ->',
  '      val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")',
  '      context.getSharedPreferences("guard_prefs", Context.MODE_PRIVATE)',
  '        .edit().putStringSet("blocked_apps", apps.toSet()).apply()',
  '      "ok"',
  '    }',
  '',
  '    Function("startAppWatcher") {',
  '      val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")',
  '      val intent = Intent(context, AppWatcherService::class.java)',
  '      if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent)',
  '      else context.startService(intent)',
  '      "watcher started"',
  '    }',
  '',
  '    Function("stopAppWatcher") {',
  '      val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")',
  '      context.stopService(Intent(context, AppWatcherService::class.java))',
  '      "watcher stopped"',
  '    }',
  '',
  '    Function("hasOverlayPermission") {',
  '      val context = appContext.reactContext ?: return@Function false',
  '      Settings.canDrawOverlays(context)',
  '    }',
  '',
  '    Function("openOverlaySettings") {',
  '      val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")',
  '      context.startActivity(',
  '        Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + context.packageName))',
  '          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)',
  '      )',
  '    }',
  '',
].join('\n');
s = s.replace(anchor, block + anchor);
fs.writeFileSync(f, s);
console.log('OK: GuardModule + 5 watcher functions');
