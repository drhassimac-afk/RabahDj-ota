#!/bin/bash
D=node_modules/react-native-android-notification-listener/android
[ -d "$D" ] || exit 0
cat > "$D/build.gradle" << 'GRADLE'
apply plugin: 'com.android.library'

def rootExt(name, fallback) {
  return rootProject.ext.has(name) ? rootProject.ext.get(name) : fallback
}

android {
  namespace "com.lesimoes.androidnotificationlistener"
  compileSdkVersion rootExt('compileSdkVersion', 36)

  defaultConfig {
    minSdkVersion rootExt('minSdkVersion', 24)
    targetSdkVersion rootExt('targetSdkVersion', 36)
  }

  compileOptions {
    sourceCompatibility JavaVersion.VERSION_17
    targetCompatibility JavaVersion.VERSION_17
  }
}

repositories {
  google()
  mavenCentral()
}

dependencies {
  implementation "com.facebook.react:react-android"
  implementation 'com.google.code.gson:gson:2.8.6'
}
GRADLE
sed -i 's/android:allowBackup="false"//' "$D/src/main/AndroidManifest.xml"
echo "=== build.gradle replaced"
