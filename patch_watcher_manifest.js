const fs = require('fs');
const f = 'modules/guard-module/android/src/main/AndroidManifest.xml';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('AppWatcherService')) { console.log('مثبت مسبقاً'); process.exit(0); }
const permA = '<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />';
if (!s.includes(permA)) { console.error('FAIL: permission anchor'); process.exit(1); }
s = s.replace(permA, permA +
  '\n  <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />' +
  '\n  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />');
const closeA = '</application>';
if (!s.includes(closeA)) { console.error('FAIL: application anchor'); process.exit(1); }
s = s.replace(closeA,
  '  <service android:name="com.rabahdj.app.guard.AppWatcherService"\n' +
  '             android:exported="false"\n' +
  '             android:foregroundServiceType="specialUse">\n' +
  '      <property android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"\n' +
  '                android:value="Parental control app blocking monitor" />\n' +
  '    </service>\n' + closeA);
fs.writeFileSync(f, s);
console.log('OK: manifest (SYSTEM_ALERT_WINDOW + specialUse + service)');
