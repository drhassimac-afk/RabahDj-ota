const fs = require('fs');
const f = 'src/app/_layout.tsx';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('checkForUpdateAsync')) { console.log('مثبت مسبقاً'); process.exit(0); }

const inject = [
  '',
  "// [ota-immediate] فحص وتفعيل فوري لأي تحديث JS عند كل إطلاق (production فقط)",
  "import * as Updates from 'expo-updates';",
  'void (async () => {',
  '  try {',
  '    if (__DEV__) return;',
  '    const check = await Updates.checkForUpdateAsync();',
  '    if (check.isAvailable) {',
  '      await Updates.fetchUpdateAsync();',
  '      await Updates.reloadAsync();',
  '    }',
  '  } catch (e) {',
  "    console.warn('OTA check failed:', e);",
  '  }',
  '})();',
].join('\n');

const lines = s.split('\n');
let lastImport = -1;
lines.forEach((l, i) => { if (/^import /.test(l)) lastImport = i; });
if (lastImport === -1) { console.error('FAIL: no imports found'); process.exit(1); }
lines.splice(lastImport + 1, 0, inject);
fs.writeFileSync(f, lines.join('\n'));
console.log('OK: OTA immediate check injected after imports');
