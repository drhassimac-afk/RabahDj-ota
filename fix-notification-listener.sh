#!/bin/bash
F=node_modules/react-native-android-notification-listener/android/build.gradle
if [ -f "$F" ]; then
  # نسف jcenter() الميتة من الجذور لتفادي انهيار Gradle 9
  sed -i '/jcenter()/d' "$F"
  # استبدال التبعية العائمة وتثبيت الـ release لـ react-android
  sed -i 's/implementation "com.facebook.react:react-native:+"/implementation module("com.facebook.react:react-android:0.86.3") { attributes { attribute(Attribute.of("com.android.build.api.attributes.BuildTypeAttr", String.class), "release") } }/g' "$F"
  sed -i "s/implementation 'com.facebook.react:react-native:+'/implementation module(\"com.facebook.react:react-android:0.86.3\") { attributes { attribute(Attribute.of(\"com.android.build.api.attributes.BuildTypeAttr\", String.class), \"release\") } }/g" "$F"
  echo "=== 🟢 SUCCESS: patched $F for Gradle 9 and React Native 0.86.3 ==="
  sed -n '55,115p' "$F"
else
  echo "=== ⚠️ WARNING: $F not found ==="
fi
