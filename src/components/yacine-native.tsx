import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  Modal,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as ScreenOrientation from 'expo-screen-orientation';

interface YacineNativeProps {
  onClose: () => void;
}

export default function YacineNative({ onClose }: YacineNativeProps) {
  const VIPER_M3U_URL =
     "https://iptv.domains/get.php?username=VN637HFH&password=L484RBCR&type=m3u_plus";                        

  // لا نخمن صيغة nxtv.top قبل التأكد من الـ API/URL المطلوب للموقع.
  const playerWebUrl = `https://iptv.domains/?url=${encodeURIComponent(VIPER_M3U_URL)}`;

  useEffect(() => {
    ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT
    ).catch(() => {});

    return () => {
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT
      ).catch(() => {});
    };
  }, []);

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            📺 قنوات المباشرة Rabah
          </Text>

          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
          >
            <Text style={styles.closeText}>رجوع ←</Text>
          </TouchableOpacity>
        </View>

        <WebView
          style={styles.webview}
          source={{ uri: playerWebUrl }}
          javaScriptEnabled
          domStorageEnabled
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          userAgent="Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36"
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1220',
    paddingTop: Platform.OS === 'ios' ? 40 : 0,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#161f30',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#232e42',
  },

  headerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },

  closeBtn: {
    backgroundColor: '#ff1e27',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
  },

  closeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },

  webview: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
});
