const fs = require('fs');
const f = 'src/app/parental.tsx';
let s = fs.readFileSync(f, 'utf8');
const old = 'const fetchChildApps = useCallback(async (cid: number | string) => {\n    try {';
const neu = 'const fetchChildApps = useCallback(async (cid?: number | string | null) => {\n    try {\n      if (cid == null) return;';
if (s.includes(neu)) { console.log('مثبت مسبقاً'); process.exit(0); }
if (!s.includes(old)) { console.error('FAIL: fetchChildApps signature not found'); process.exit(1); }
s = s.replace(old, neu);
fs.writeFileSync(f, s);
console.log('OK: signature fixed');
