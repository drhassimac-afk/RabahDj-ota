const fs = require('fs');
const f = 'src/app/parental.tsx';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('[fs-probe]')) { console.log('مثبت مسبقاً'); process.exit(0); }

// مرساة حرفية من الملف الحي (الناتج 5):
const OLD = [
  "let FSmod: any = null;",
  "let diagFS = '';     // [stream-diag]",
  "try {",
  "  try { FSmod = require('expo-file-system/legacy'); diagFS = 'legacy'; }",
  "  catch { FSmod = require('expo-file-system'); diagFS = 'main'; }",
  "  if (!FSmod?.writeAsStringAsync) diagFS += ' (تنبيه: writeAsStringAsync غير متاح!)';",
  "} catch (e: any) { diagFS = 'فشل استيراد expo-file-system: ' + String((e as any)?.message ?? String(e)); }",
].join('\n');
if (!s.includes(OLD)) { console.error('FAIL: diagFS anchor — النص الحي يختلف'); process.exit(1); }

const NEW = [
  "let FSmod: any = null;",
  "let diagFS = '';     // [stream-diag]",
  "try {",
  "  try { FSmod = require('expo-file-system/legacy'); diagFS = 'legacy'; }",
  "  catch { FSmod = require('expo-file-system'); diagFS = 'main'; }",
  "  if (!FSmod?.writeAsStringAsync) diagFS += ' (تنبيه: writeAsStringAsync غير متاح!)';",
  "  // [fs-probe] الواجهة الحقيقية تُعرض في الشريط:",
  "  diagFS += ' | ' + JSON.stringify({",
  "    write: typeof FSmod?.writeAsStringAsync,",
  "    EncodingType: typeof FSmod?.EncodingType,",
  "    Base64Val: FSmod?.EncodingType?.Base64 != null ? String(FSmod.EncodingType.Base64) : 'undef',",
  "  });",
  "} catch (e: any) { diagFS = 'فشل استيراد expo-file-system: ' + String((e as any)?.message ?? String(e)); }",
].join('\n');
s = s.replace(OLD, NEW);

// الترميز الآمن (مرساة حية من نص startListening الحالي):
const encA = "                const enc = FSmod?.EncodingType?.Base64 ?? 'base64';";
if (!s.includes(encA)) { console.error('FAIL: enc anchor'); process.exit(1); }
s = s.replace(encA,
"                const enc = (FSmod?.EncodingType?.Base64 != null)\n                  ? FSmod.EncodingType.Base64\n                  : 'base64';   // [fs-probe] safe fallback");

fs.writeFileSync(f, s);
console.log('OK: fs-probe (interface exposure + safe encoding)');
