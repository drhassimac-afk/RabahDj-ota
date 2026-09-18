import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { mediaDevices, RTCView } from 'react-native-webrtc';

export default function TestWebRTC() {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    mediaDevices.getUserMedia({ video: true, audio: true })
      .then(s => setStream(s))
      .catch(e => setError(e.message));
  }, []);

  return (
    <View style={styles.container}>
      {error && <Text style={styles.error}>خطأ: {error}</Text>}
      {stream ? (
        <RTCView streamURL={stream.toURL()} style={styles.video} objectFit="cover" />
      ) : (
        <Text style={styles.text}>جاري تشغيل الكاميرا...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220', justifyContent: 'center', alignItems: 'center' },
  video: { width: '100%', height: '100%' },
  text: { color: '#fff', fontSize: 16 },
  error: { color: 'red', fontSize: 14, padding: 20, textAlign: 'center' },
});
