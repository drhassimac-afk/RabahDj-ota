const fs = require('fs');
const path = require('path');
const vm = require('vm');

const tsPath = path.join(__dirname, '..', 'src', 'htmlContent.ts');
const htmlPath = path.join(__dirname, '..', 'assets', 'rabahdj.html');

const tsContent = fs.readFileSync(tsPath, 'utf8');
const match = tsContent.match(/export const RABAHDJ_HTML = (".*");?\s*$/s);
if (!match) {
  console.error('❌ ما قدرت ألقى نمط "export const RABAHDJ_HTML = ...". توقفت بدون أي تعديل.');
  process.exit(1);
}

// تقييم آمن لسطر الـ string فقط (بدون تنفيذ أي كود ثاني)
const originalHtml = vm.runInNewContext(match[1]);
console.log('1) استخرجت المحتوى الأصلي، الطول:', originalHtml.length, 'حرف');

fs.writeFileSync(htmlPath, originalHtml, 'utf8');
console.log('2) كتبت assets/rabahdj.html');

const roundTripHtml = fs.readFileSync(htmlPath, 'utf8');
if (roundTripHtml !== originalHtml) {
  console.error('❌ فحص القراءة رجع مختلف عن الأصل! توقفت — لم يتم تعديل htmlContent.ts.');
  process.exit(1);
}
console.log('3) ✅ فحص القراءة مطابق تمامًا للأصل');

const generatedJsString = JSON.stringify(roundTripHtml);
const generatedTs =
  '// هذا الملف يُنشأ تلقائيًا من assets/rabahdj.html — لا تعدّله يدويًا أبدًا\n' +
  '// أي تعديل على محتوى الصفحة يصير في assets/rabahdj.html فقط\n' +
  '// بعده شغّل: node scripts/build-html-content.js\n' +
  'export const RABAHDJ_HTML = ' + generatedJsString + ';\n';

// فحص الأمان الحاسم: نتحقق إن الكود المولّد الجديد يرجع نفس المحتوى بالضبط قبل ما نحفظه
const verifyMatch = generatedTs.match(/export const RABAHDJ_HTML = (".*");?\s*$/s);
const verifyHtml = vm.runInNewContext(verifyMatch[1]);
if (verifyHtml !== originalHtml) {
  console.error('❌ التحقق النهائي فشل! الملف الجديد لن يعطي نفس المحتوى. توقفت — لم يتم تعديل htmlContent.ts.');
  process.exit(1);
}
console.log('4) ✅ التحقق النهائي مطابق 100% — آمن للحفظ');

fs.writeFileSync(tsPath, generatedTs, 'utf8');
console.log('5) ✅ تم توليد src/htmlContent.ts الجديد (مولّد تلقائيًا)، الحجم:', generatedTs.length, 'بايت');
