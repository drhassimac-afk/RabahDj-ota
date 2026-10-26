const fs = require('fs');
const f = 'modules/guard-module/android/src/main/java/com/rabahdj/app/guard/AppWatcherService.kt';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('forcedLockActive')) { console.log('مثبت مسبقاً'); process.exit(0); }

// 1) دالة القفل الفعّال — تُقرأ كل tick
const anchor = '  private fun checkOnce() {';
if (!s.includes(anchor)) { console.error('FAIL: checkOnce anchor'); process.exit(1); }
const add = [
  '  private fun forcedLockActive(): Boolean =',
  '    prefs.getString("forced_lock", "false") == "true"',
  '',
  '  private fun showLockOverlay() {',
  '    // الغطاء نفسه (عناصر مُعاد استخدامها من showOverlay لكن برسالة القفل)',
  '    if (overlayView != null) {',
  '      overlayView?.text = "🔒 الجهاز مقفل بواسطة ولي الأمر"',
  '      return',
  '    }',
  '    showOverlay()',
  '    overlayView?.text = "🔒 الجهاز مقفل بواسطة ولي الأمر"',
  '  }',
  '',
].join('\n');
s = s.replace(anchor, add + anchor);

// 2) داخل checkOnce: القفل اليدوي يتقدم على كل شيء
const oc = '  private fun checkOnce() {\n    val blocked = blockedApps()\n    val fg = foregroundPackage()';
if (!s.includes(oc)) { console.error('FAIL: checkOnce body anchor'); process.exit(1); }
s = s.replace(oc, '  private fun checkOnce() {\n' +
  '    if (forcedLockActive()) {\n' +
  '      showLockOverlay()\n' +
  '      val now2 = System.currentTimeMillis()\n' +
  '      if (now2 - lastLaunchAt > 5000) { lastLaunchAt = now2; launchOurApp() }\n' +
  '      return\n' +
  '    }\n' +
  '    hideOverlay()\n' +
  '    val blocked = blockedApps()\n' +
  '    val fg = foregroundPackage()');

fs.writeFileSync(f, s);
console.log('OK: forced lock effect installed');
