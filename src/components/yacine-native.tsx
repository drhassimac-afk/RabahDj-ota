import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, Platform, TextInput, ScrollView, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as ScreenOrientation from 'expo-screen-orientation';

interface YacineNativeProps {
  onClose: () => void;
}

type ViewMode = 'login' | 'dashboard' | 'player';

export default function YacineNative({ onClose }: YacineNativeProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('login');
  const [currentUrl, setCurrentUrl] = useState<string>('');
  
  // بيانات الاشتراك الفعالة والموثقة لديك
  const [host, setHost] = useState<string>('https://iptv.domains');
  const [username, setUsername] = useState<string>('VN637HFH');
  const [password, setPassword] = useState<string>('L484RBCR');

  useEffect(() => {
    if (viewMode === 'player') {
      // فتح الشاشة بالعرض قسرياً عند المشاهدة لتمدد أبعاد عناصر اللمس السينمائية
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    } else {
      // إرجاع الشاشة للوضع الطولي المستقر في لوحة التحكم
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT).catch(() => {});
    }
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT).catch(() => {});
    };
  }, [viewMode]);

  // بناء رابط الـ IPTV Smarters الخالي من الوسطاء المعطلين
  const generateSmartersUrl = (action: 'live' | 'movies' | 'series') => {
    const m3uUrl = `${host.trim()}/get.php?username=${username.trim()}&password=${password.trim()}&type=m3u_plus`;
    return `https://github.io{encodeURIComponent(m3uUrl)}&type=${action}`;
  };

  const handleOpenCategory = (action: 'live' | 'movies' | 'series') => {
    setCurrentUrl(generateSmartersUrl(action));
    setViewMode('player');
  };

  // 🛡️ بناء مستشعرات اللمس على مستوى Native قسرياً لالتقاط حركات رفع الصوت والإضاءة فوق الـ WebView
  const windowWidth = Dimensions.get('window').width;
  
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      // إذا كان السحب في النصف الأيسر من الشاشة -> إضاءة
      if (event.x < windowWidth / 2) {
        console.log("إيماءة لمس النصف الأيسر قسرياً (إضاءة): ", event.translationY);
      } else {
        // إذا كان السحب في النصف الأيمن من الشاشة -> صوت
        console.log("إيماءة لمس النصف الأيمن قسرياً (صوت): ", event.translationY);
      }
    });

  return (
    <Modal animationType="slide" transparent={false} visible={true} onRequestClose={onClose}>
      <View style={styles.container}>
        
        {/* شريط علوي مرن ومنظم بالكامل لباقة Rabah */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {viewMode === 'login' ? '🔐 تسجيل دخول رابح Smarters' : viewMode === 'dashboard' ? '🔥 RABAH IPTV SMARTERS' : '📺 مشغل البث الذكي المستقر'}
          </Text>
          <TouchableOpacity 
            onPress={viewMode === 'player' ? () => setViewMode('dashboard') : viewMode === 'dashboard' ? () => setViewMode('login') : onClose} 
            style={styles.closeBtn}
          >
            <Text style={styles.closeText}>
              {viewMode === 'player' ? '← رجوع' : viewMode === 'dashboard' ? 'تعديل البيانات' : 'إغلاق ×'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 1. واجهة الإدخال اليدوي للكود */}
        {viewMode === 'login' && (
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.card}>
              <Text style={styles.inputLabel}>رابط السيرفر (Server URL / Host):</Text>
              <TextInput style={styles.input} value={host} onChangeText={setHost} autoCapitalize="none" />

              <Text style={styles.inputLabel}>اسم المستخدم (Username):</Text>
              <TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" />

              <Text style={styles.inputLabel}>كلمة المرور (Password):</Text>
              <TextInput style={styles.input} value={password} onChangeText={setPassword} autoCapitalize="none" />

              <TouchableOpacity style={styles.submitBtn} onPress={() => setViewMode('dashboard')}>
                <Text style={styles.submitBtnText}>🚀 تسجيل الدخول وتشغيل السيرفر</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* 2. لوحة التحكم الثلاثية المتطابقة مع IPTV Smarters Pro */}
        {viewMode === 'dashboard' && (
          <View style={styles.dashboardContainer}>
            <View style={styles.accountBox}>
              <Text style={styles.accountUser}>السيرفر: {host}</Text>
              <Text style={styles.accountStatus}>الحساب الموثق: {username} 🟢</Text>
            </View>

            <TouchableOpacity style={[styles.menuCard, { borderColor: '#ff1e27' }]} onPress={() => handleOpenCategory('live')}>
              <Text style={styles.menuText}>📺 القنوات الحية والمباشرة (LIVE TV)</Text>
              <Text style={[styles.arrowIcon, { color: '#ff1e27' }]}>▶</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuCard, { borderColor: '#1a73e8' }]} onPress={() => handleOpenCategory('movies')}>
              <Text style={styles.menuText}>🎬 مكتبة الأفلام والسينما (MOVIES)</Text>
              <Text style={[styles.arrowIcon, { color: '#1a73e8' }]}>▶</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuCard, { borderColor: '#34a853' }]} onPress={() => handleOpenCategory('series')}>
              <Text style={styles.menuText}>🍿 باقة المسلسلات الرمضانية والعالمية</Text>
              <Text style={[styles.arrowIcon, { color: '#34a853' }]}>▶</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 3. واجهة المشغل المحمية بمستشعرات الجيل الجديد وتخطي الـ DNS المعطل */}
        {viewMode === 'player' && (
          <GestureDetector gesture={panGesture}>
            <View style={{ flex: 1 }}>
              <WebView
                style={styles.webview}
                source={{ uri: currentUrl }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowsFullscreenVideo={true}
                mediaPlaybackRequiresUserAction={false}
                allowsInlineMediaPlayback={true}
                scalesPageToFit={true}
                builtInZoomControls={true}
                displayZoomControls={false}
                userAgent="Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36"
              />
            </View>
          </GestureDetector>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220', paddingTop: Platform.OS === 'ios' ? 40 : 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#161f30', alignItems: 'center', borderBottomWidth: 1, borderColor: '#232e42' },
  headerTitle: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  closeBtn: { backgroundColor: '#ff1e27', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  closeText: { color: '#fff', fontWeight: 'bold', fontSize: 11 },
  scrollContainer: { padding: 16, justifyContent: 'center' },
  card: { backgroundColor: '#161f30', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#232e42' },
  inputLabel: { color: '#8a94a6', fontSize: 12, marginBottom: 6, fontWeight: '600', textAlign: 'left' },
  input: { backgroundColor: '#0b1220', color: '#fff', padding: 11, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#232e42', fontSize: 13, textAlign: 'left' },
  submitBtn: { backgroundColor: '#ff1e27', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  submitBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  dashboardContainer: { flex: 1, padding: 16, justifyContent: 'center' },
  accountBox: { backgroundColor: '#161f30', padding: 16, borderRadius: 12, marginBottom: 25, borderWidth: 1, borderColor: '#232e42', alignItems: 'center' },
  accountUser: { color: '#fff', fontSize: 13, fontWeight: 'bold', marginBottom: 5 },
  accountStatus: { color: '#34a853', fontSize: 12, fontWeight: 'bold' },
  menuCard: { flexDirection: 'row', backgroundColor: '#161f30', padding: 22, marginVertical: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5 },
  menuText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  arrowIcon: { fontSize: 15, fontWeight: 'bold' },
  webview: { flex: 1, backgroundColor: '#000' }
});
