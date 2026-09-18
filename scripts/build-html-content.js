const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlPath = path.join(__dirname, '..', 'assets', 'rabahdj.html');
const tsPath = path.join(__dirname, '..', 'src', 'htmlContent.ts');

const html = fs.readFileSync(htmlPath, 'utf8');
console.log('1) قرأت assets/rabahdj.html، الطول:', html.length, 'حرف');

const generatedJsString = JSON.stringify(html);
const generatedTs =
  '// هذا الملف يُنشأ تلقائيًا من assets/rabahdj.html — لا تعدّله يدويًا أبدًا\n' +
  '// أي تعديل على محتوى الصفحة يصير في assets/rabahdj.html فقط\n' +
  '// بعده شغّل: node scripts/build-html-content.js\n' +
  'export const RABAHDJ_HTML = ' + generatedJsString + ';\n';

const verifyMatch = generatedTs.match(/export const RABAHDJ_HTML = (".*");?\s*$/s);
const verifyHtml = vm.runInNewContext(verifyMatch[1]);
if (verifyHtml !== html) {
  console.error('❌ التحقق فشل! الملف الجديد لن يعطي نفس المحتوى. توقفت — لم يتم تعديل htmlContent.ts.');
  process.exit(1);
}
console.log('2) ✅ التحقق مطابق 100% — آمن للحفظ');

fs.writeFileSync(tsPath, generatedTs, 'utf8');
console.log('3) ✅ تم تحديث src/htmlContent.ts، الحجم:', generatedTs.length, 'بايت');
