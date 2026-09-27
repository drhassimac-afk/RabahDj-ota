import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, Platform, TextInput, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';
import * as ScreenOrientation from 'expo-screen-orientation';

interface YacineNativeProps {
  onClose: () => void;
}

type ViewMode = 'login' | 'dashboard' | 'player';

export default function YacineNative({ onClose }: YacineNativeProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('login');
  const [currentUrl, setCurrentUrl] = useState<string>('');
  
  const [host, setHost] = useState<string>('https://iptv.domains');
  const [username, setUsername] = useState<string>('VN637HFH');
  const [password, setPassword] = useState<string>('L484RBCR');

  useEffect(() => {
    if (viewMode === 'player') {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT).catch(() => {});
    }
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT).catch(() => {});
    };
  }, [viewMode]);

  const generateSmartersUrl = (action: 'live' | 'movies' | 'series') => {
    const cleanHost = host.trim();
    const cleanUser = username.trim();
    const cleanPass = password.trim();
    
    // بناء رابط الـ M3U المباشر والمعتمد برمجياً للسيرفر الخاص بك
    const m3uUrl = `${cleanHost}/get.php?username=${cleanUser}&password=${cleanPass}&type=m3u_plus`;
    
    // استخدام المشغل العالمي المفتوح والمستقر والمقاوم للحظر لقراءة قنواتك مباشرة
    return `https://github.io{encodeURIComponent(m3uUrl)}&type=${action}`;
  };

  const handleOpenCategory = (action: 'live' | 'movies' | 'series') => {
    const targetUrl = generateSmartersUrl(action);
    setCurrentUrl(targetUrl);
    setViewMode('player');
  };

  const handleBackToDashboard = async () => {
    setViewMode('dashboard');
  };

  return (
    <Modal animationType="slide" transparent={false} visible={true} onRequestClose={onClose}>
      <View style={styles.container}>
        
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {viewMode === 'login' ? '🔐 إدخال اشتراك IPTV يدوياً' : viewMode === 'dashboard' ? '🔥 RABAH IPTV SMARTERS' : '📺 مشغل الفيديو الذكي'}
          </Text>
          <TouchableOpacity 
            onPress={viewMode === 'player' ? handleBackToDashboard : viewMode === 'dashboard' ? () => setViewMode('login') : onClose} 
            style={styles.closeBtn}
          >
            <Text style={styles.closeText}>
              {viewMode === 'player' ? '← رجوع' : viewMode === 'dashboard' ? 'تعديل السيرفر' : 'إغلاق ×'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 1. واجهة الإدخال اليدوي للكود */}
        {viewMode === 'login' && (
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.card}>
              <Text style={styles.inputLabel}>رابط السيرفر (Server URL / Host):</Text>
              <TextInput 
                style={styles.input} 
                value={host} 
                onChangeText={setHost} 
                placeholder="https://example.com" 
                placeholderTextColor="#5b6785"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>اسم المستخدم (Username):</Text>
              <TextInput 
                style={styles.input} 
                value={username} 
                onChangeText={setUsername} 
                placeholder="Username" 
                placeholderTextColor="#5b6785"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>كلمة المرور (Password):</Text>
              <TextInput 
                style={styles.input} 
                value={password} 
                onChangeText={setPassword} 
                placeholder="Password" 
                placeholderTextColor="#5b6785"
                autoCapitalize="none"
              />

              <TouchableOpacity style={styles.submitBtn} onPress={() => setViewMode('dashboard')}>
                <Text style={styles.submitBtnText}>🚀 ربط وتشغيل السيرفر المباشر</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* 2. واجهة الأقسام الثلاثة الرئيسية */}
        {viewMode === 'dashboard' && (
          <View style={styles.dashboardContainer}>
            <View style={styles.accountBox}>
              <Text style={styles.accountUser}>السيرفر النشط: {host}</Text>
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
              <Text style={styles.menuText}>🍿 أحدث المسلسلات العربية والأجنبية</Text>
              <Text style={[styles.arrowIcon, { color: '#34a853' }]}>▶</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 3. المشغل العالمي المستقر والمستجيب كلياً للمس والصوت */}
        {viewMode === 'player' && (
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
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220', paddingTop: Platform.OS === 'ios' ? 40 : 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#161f30', alignItems: 'center', borderBottomWidth: 1, borderColor: '#232e42' },
  headerTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  closeBtn: { backgroundColor: '#ff1e27', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  closeText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  scrollContainer: { padding: 16, justifyContent: 'center' },
  card: { backgroundColor: '#161f30', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#232e42' },
  inputLabel: { color: '#8a94a6', fontSize: 13, marginBottom: 8, fontWeight: '600', textAlign: 'left' },
  input: { backgroundColor: '#0b1220', color: '#fff', padding: 12, borderRadius: 8, marginBottom: 18, borderWidth: 1, borderColor: '#232e42', fontSize: 14, textAlign: 'left' },
  submitBtn: { backgroundColor: '#ff1e27', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  dashboardContainer: { flex: 1, padding: 16, justifyContent: 'center' },
  accountBox: { backgroundColor: '#161f30', padding: 16, borderRadius: 12, marginBottom: 25, borderWidth: 1, borderColor: '#232e42', alignItems: 'center' },
  accountUser: { color: '#fff', fontSize: 13, fontWeight: 'bold', marginBottom: 5 },
  accountStatus: { color: '#34a853', fontSize: 12, fontWeight: 'bold' },
  menuCard: { flexDirection: 'row', backgroundColor: '#161f30', padding: 22, marginVertical: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5 },
  menuText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  arrowIcon: { fontSize: 16, fontWeight: 'bold' },
  webview: { flex: 1, backgroundColor: '#000' }
});
