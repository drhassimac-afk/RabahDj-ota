#!/data/data/com.termux/files/usr/bin/bash
# استخدام: bash switch-account.sh <اسم-الحساب>
set -e

TARGET="$1"
TRACK_FILE="eas-accounts.md"

if [ -z "$TARGET" ]; then
  echo "الاستخدام: bash switch-account.sh <اسم-الحساب>"
  echo "شغّل: grep '^## ' eas-accounts.md   لعرض الحسابات المعروفة"
  exit 1
fi

if [ ! -f "$TRACK_FILE" ]; then
  echo "❌ ملف $TRACK_FILE غير موجود بالمجلد الحالي. تأكد إنك بمجلد المشروع."
  exit 1
fi

EMAIL=$(awk -v t="## $TARGET" '$0==t{f=1;next} /^## /{f=0} f && /الإيميل/{print; exit}' "$TRACK_FILE" | sed 's/.*: //' | sed 's/ (.*//')

if [ -z "$EMAIL" ]; then
  echo "⚠️ الحساب '$TARGET' غير موجود بـ $TRACK_FILE — أضفه يدويًا أول."
  exit 1
fi

WHOAMI_OUT=$(eas whoami 2>/dev/null || echo "")
CURRENT_EMAIL=$(echo "$WHOAMI_OUT" | sed -n '2p')

echo "الحساب المطلوب: $TARGET"
echo "الإيميل المطلوب: $EMAIL"
echo "الإيميل الحالي المسجل دخول فيه: ${CURRENT_EMAIL:-غير مسجل دخول}"

if [ "$CURRENT_EMAIL" != "$EMAIL" ]; then
  echo ""
  echo "🔑 محتاج تسجّل دخول بإيميل مختلف. شغّل الأمرين التاليين يدويًا:"
  echo "   eas logout"
  echo "   eas login"
  echo "وسجّل دخول بإيميل: $EMAIL"
  echo "بعدها أعد تشغيل: bash switch-account.sh $TARGET"
  exit 2
fi

echo "✅ الجلسة صحيحة، أعدّل app.json..."

node -e "
const fs = require('fs');
const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
app.expo.owner = '$TARGET';
fs.writeFileSync('app.json', JSON.stringify(app, null, 2) + '\n');
console.log('   owner -> $TARGET');
"

PID=$(awk -v t="## $TARGET" '$0==t{f=1;next} /^## /{f=0} f && /projectId/{print; exit}' "$TRACK_FILE" | sed 's/.*: //' | sed 's/ (.*//')

if [ -n "$PID" ] && [ "$PID" != "غير" ]; then
  node -e "
  const fs = require('fs');
  const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
  if (!app.expo.extra) app.expo.extra = {};
  if (!app.expo.extra.eas) app.expo.extra.eas = {};
  app.expo.extra.eas.projectId = '$PID';
  fs.writeFileSync('app.json', JSON.stringify(app, null, 2) + '\n');
  console.log('   projectId -> $PID');
  "
  echo ""
  echo "✅ جاهز — جرب البناء مباشرة:"
  echo "   EAS_SKIP_AUTO_FINGERPRINT=1 eas build --platform android --profile preview"
else
  node -e "
  const fs = require('fs');
  const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
  if (app.expo.extra && app.expo.extra.eas) delete app.expo.extra.eas.projectId;
  fs.writeFileSync('app.json', JSON.stringify(app, null, 2) + '\n');
  "
  echo ""
  echo "ℹ️ ما فيه projectId محفوظ لهذا الحساب بعد. شغّل:"
  echo "   eas init --non-interactive --force"
  echo "وبعدها انسخ الـ projectId الجديد وحطه يدويًا بملف $TRACK_FILE تحت '## $TARGET'"
fi
