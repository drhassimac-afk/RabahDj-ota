#!/data/data/com.termux/files/usr/bin/bash
set -e

TARGET="$1"
TRACK_FILE="eas-accounts.md"

if [ -z "$TARGET" ]; then
  echo "الاستخدام: bash switch-account.sh <اسم-الحساب>"
  echo "الحسابات:"
  grep '^## ' "$TRACK_FILE" | sed 's/^## /  - /'
  exit 1
fi

if [ ! -f "$TRACK_FILE" ]; then
  echo "❌ ملف $TRACK_FILE غير موجود."
  exit 1
fi

EMAIL=$(awk -v t="## $TARGET" '
  $0==t {f=1; next}
  /^## / {f=0}
  f && /الإيميل/ {
    print;
    exit
  }
' "$TRACK_FILE" | sed 's/.*: //' | sed 's/ (.*//')

PID=$(awk -v t="## $TARGET" '
  $0==t {f=1; next}
  /^## / {f=0}
  f && /projectId:/ {
    print;
    exit
  }
' "$TRACK_FILE" | sed 's/.*projectId: //' | sed 's/ .*//')

echo "الحساب المطلوب: $TARGET"
echo "الإيميل: ${EMAIL:-غير معروف}"
echo "projectId: ${PID:-غير معروف}"

if [ -z "$PID" ] || [ "$PID" = "غير" ] || [ "$PID" = "غير معروف" ]; then
  echo ""
  echo "⚠️ لا يوجد projectId معروف لهذا الحساب."
  echo "لن يتم تعديل app.json ولن يتم تشغيل eas init تلقائيًا."
  echo ""
  echo "السبب: إنشاء مشروع جديد هنا قد يفصل التطبيق عن مشروع EAS الحالي."
  exit 2
fi

echo ""
echo "الجلسة الحالية:"
eas whoami || true

echo ""
echo "⚠️ سيتم فقط تغيير owner و projectId إلى:"
echo "   owner     = $TARGET"
echo "   projectId = $PID"
echo ""

read -r -p "متابعة؟ اكتب YES: " CONFIRM

if [ "$CONFIRM" != "YES" ]; then
  echo "تم الإلغاء بدون أي تعديل."
  exit 0
fi

cp app.json "app.json.backup-$(date +%Y%m%d-%H%M%S)"

node -e "
const fs = require('fs');
const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));

app.expo.owner = '$TARGET';

if (!app.expo.extra) app.expo.extra = {};
if (!app.expo.extra.eas) app.expo.extra.eas = {};

app.expo.extra.eas.projectId = '$PID';

fs.writeFileSync('app.json', JSON.stringify(app, null, 2) + '\n');
"

echo ""
echo "✅ تم تعديل app.json بأمان."
echo ""
grep -n -A3 -B2 '"owner"\|"projectId"' app.json

echo ""
echo "للبناء:"
echo "EAS_SKIP_AUTO_FINGERPRINT=1 eas build --platform android --profile preview"
