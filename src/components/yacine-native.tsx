import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavBar from 'expo-navigation-bar';
import * as Brightness from 'expo-brightness';
import { VolumeManager } from 'react-native-volume-manager';

import {
  login,
  saveCredentials,
  getSavedCredentials,
  clearCredentials,
  getLiveCategories,
  getLiveStreams,
  getStreamUrl,
} from '../../api/xtream';

interface YacineNativeProps {
  onClose: () => void;
}

type Credentials = {
  server: string;
  username: string;
  password: string;
};

type CategoryItem = {
  category_id: string | number;
  category_name: string;
};

type Channel = {
  stream_id: string | number;
  name: string;
  stream_icon?: string;
};

type Screen = 'login' | 'categories' | 'channels';

// ============================================================
// مشغّل الفيديو (ملء شاشة + تحكم بالسحب بالصوت/الإضاءة)
// ============================================================
function PlayerView({
  streamUrl,
  channelName,
  onMinimize,
  onClose,
}: {
  streamUrl: string;
  channelName: string;
  onMinimize: () => void;
  onClose: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const fullscreenRef = useRef(false);
  const [indicator, setIndicator] = useState<{
    type: 'brightness' | 'volume';
    value: number;
  } | null>(null);

  const brightnessStart = useRef(0.5);
  const volumeStart = useRef(0.5);
  const currentBrightness = useRef(0.5);
  const currentVolume = useRef(0.5);
  const hideIndicatorTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const player = useVideoPlayer(streamUrl, (p) => {
    p.play();
  });

  useEffect(() => {
    (async () => {
      try {
        const b = await Brightness.getBrightnessAsync();
        currentBrightness.current = b;
      } catch {
        // تجاهل لو ما فيه صلاحية
      }
      try {
        const v = await VolumeManager.getVolume();
        const volNum = typeof v === 'number' ? v : (v as any)?.volume ?? 0.5;
        currentVolume.current = volNum;
      } catch {
        // تجاهل
      }
    })();

    VolumeManager.showNativeVolumeUI({ enabled: false });

    return () => {
      VolumeManager.showNativeVolumeUI({ enabled: true });
      if (hideIndicatorTimeout.current) clearTimeout(hideIndicatorTimeout.current);
    };
  }, []);

  const toggleFullscreen = async () => {
    const nextFullscreen = !fullscreenRef.current;

    // نبدل الواجهة بصريًا أولاً، بغض النظر عن نجاح قفل الاتجاه
    fullscreenRef.current = nextFullscreen;
    setFullscreen(nextFullscreen);

    try {
      if (nextFullscreen) {
        NavBar.setVisibilityAsync('hidden').catch(() => {});

        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE_LEFT
        );
      } else {
        NavBar.setVisibilityAsync('visible').catch(() => {});

        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT
        );
      }
    } catch (error) {
      console.warn('Fullscreen orientation error:', error);
      // لا نظهر Alert ولا نتراجع عن الواجهة، فقط الاتجاه قد لا يتغير
    }
  };

  const showIndicator = (type: 'brightness' | 'volume', value: number) => {
    setIndicator({ type, value });
    if (hideIndicatorTimeout.current) clearTimeout(hideIndicatorTimeout.current);
    hideIndicatorTimeout.current = setTimeout(() => setIndicator(null), 600);
  };

  // نصف الشاشة الأيسر: إضاءة — نصف الشاشة الأيمن: صوت
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        fullscreenRef.current && Math.abs(gestureState.dy) > 8,
      onPanResponderGrant: (evt) => {
        brightnessStart.current = currentBrightness.current;
        volumeStart.current = currentVolume.current;
      },
      onPanResponderMove: (evt, gestureState) => {
        const { width, height } = Dimensions.get('window');
        const touchX = evt.nativeEvent.locationX;
        const delta = -gestureState.dy / height; // سحب لفوق = زيادة

        if (touchX < width / 2) {
          // إضاءة
          let next = brightnessStart.current + delta;
          next = Math.max(0, Math.min(1, next));
          currentBrightness.current = next;
          Brightness.setBrightnessAsync(next).catch(() => {});
          showIndicator('brightness', next);
        } else {
          // صوت
          let next = volumeStart.current + delta;
          next = Math.max(0, Math.min(1, next));
          currentVolume.current = next;
          VolumeManager.setVolume(next);
          showIndicator('volume', next);
        }
      },
    })
  ).current;

  return (
    <View style={styles.playerContainer}>
      {fullscreen && <StatusBar hidden />}

      {!fullscreen && (
        <View style={styles.header}>
          <TouchableOpacity onPress={onMinimize} style={styles.backButton}>
            <Text style={styles.backText}>تصغير ▾</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle} numberOfLines={1}>
            {channelName}
          </Text>

          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <View
        style={[
          styles.videoContainer,
          fullscreen && styles.videoContainerFullscreen,
        ]}
        {...panResponder.panHandlers}
      >
        <VideoView
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls={false}
          pointerEvents="none"
          surfaceType="textureView"
        />


        {indicator && (
          <View
            style={[
              styles.gestureIndicator,
              indicator.type === 'brightness'
                ? styles.gestureIndicatorLeft
                : styles.gestureIndicatorRight,
            ]}
            pointerEvents="none"
          >
            <Text style={styles.gestureIndicatorIcon}>
              {indicator.type === 'brightness' ? '☀️' : '🔊'}
            </Text>
            <Text style={styles.gestureIndicatorText}>
              {Math.round(indicator.value * 100)}%
            </Text>
          </View>
        )}

        {fullscreen && (
          <TouchableOpacity
            style={styles.miniBackInFullscreen}
            onPress={onMinimize}
          >
            <Text style={styles.fullscreenText}>▾ تصغير</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.fullscreenButton}
          onPress={toggleFullscreen}
        >
          <Text style={styles.fullscreenText}>
            {fullscreen ? '⛶ خروج' : '⛶ ملء الشاشة'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================================
// الفيديو المصغّر (يظهر عائمًا فوق شاشة القنوات)
// ============================================================
function MiniPlayer({
  streamUrl,
  channelName,
  onExpand,
  onClose,
}: {
  streamUrl: string;
  channelName: string;
  onExpand: () => void;
  onClose: () => void;
}) {
  const player = useVideoPlayer(streamUrl, (p) => {
    p.play();
  });

  return (
    <View style={styles.miniPlayerWrapper}>
      <TouchableOpacity
        style={styles.miniPlayerTouchable}
        activeOpacity={0.9}
        onPress={onExpand}
      >
        <VideoView
          player={player}
          style={styles.miniPlayerVideo}
          contentFit="cover"
          nativeControls={false}
          pointerEvents="none"
        />
        <Text style={styles.miniPlayerLabel} numberOfLines={1}>
          {channelName}
        </Text>
        <TouchableOpacity style={styles.miniPlayerClose} onPress={onClose}>
          <Text style={styles.miniPlayerCloseText}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
}

// ============================================================
// المكوّن الرئيسي
// ============================================================
export default function YacineNative({ onClose }: YacineNativeProps) {
  const [screen, setScreen] = useState<Screen>('login');
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  const [server, setServer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');

  const [activeChannel, setActiveChannel] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const [playerMinimized, setPlayerMinimized] = useState(false);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT
    ).catch(() => {});

    loadSavedCredentials();

    return () => {
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT
      ).catch(() => {});
    };
  }, []);

  async function loadSavedCredentials() {
    try {
      const saved = await getSavedCredentials();
      if (!saved) return;

      setServer(saved.server || '');
      setUsername(saved.username || '');
      setPassword(saved.password || '');

      await handleLogin(saved, true);
    } catch {
      // تجاهل
    }
  }

  async function handleLogin(creds?: Credentials, silent = false) {
    const current: Credentials = creds || {
      server: server.trim(),
      username: username.trim(),
      password,
    };

    if (!current.server || !current.username || !current.password) {
      if (!silent) {
        Alert.alert('تنبيه', 'أدخل السيرفر واسم المستخدم وكلمة المرور');
      }
      return;
    }

    try {
      setLoading(true);
      const result = await login(current);

      if (result?.user_info?.auth !== 1) {
        throw new Error('بيانات الدخول غير صحيحة');
      }

      await saveCredentials(current);
      setCredentials(current);
      await loadCategories(current);
    } catch (error: any) {
      if (!silent) {
        Alert.alert('فشل تسجيل الدخول', error?.message || 'تعذر الاتصال بالسيرفر');
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories(creds: Credentials) {
    try {
      setLoading(true);
      const data = await getLiveCategories(creds);
      setCategories(Array.isArray(data) ? data : []);
      setScreen('categories');
    } catch (error: any) {
      Alert.alert('خطأ', error?.message || 'تعذر جلب الفئات');
    } finally {
      setLoading(false);
    }
  }

  async function openCategory(category: CategoryItem) {
    if (!credentials) return;

    try {
      setLoading(true);
      setSelectedCategory(String(category.category_name));

      const data = await getLiveStreams(credentials, String(category.category_id));
      setChannels(Array.isArray(data) ? data : []);
      setScreen('channels');
    } catch (error: any) {
      Alert.alert('خطأ', error?.message || 'تعذر جلب القنوات');
    } finally {
      setLoading(false);
    }
  }

  function openChannel(channel: Channel) {
    if (!credentials) return;

    const url = getStreamUrl(credentials, String(channel.stream_id), 'm3u8');
    setActiveChannel({ url, name: channel.name || 'قناة' });
    setPlayerMinimized(false);
  }

  async function logout() {
    await clearCredentials();

    setCredentials(null);
    setCategories([]);
    setChannels([]);
    setSelectedCategory('');
    setActiveChannel(null);
    setPlayerMinimized(false);
    setServer('');
    setUsername('');
    setPassword('');
    setScreen('login');
  }

  function goBack() {
    if (screen === 'channels') {
      setScreen('categories');
      return;
    }
    if (screen === 'categories') {
      setScreen('login');
      return;
    }
    onClose();
  }

  function closePlayer() {
    setActiveChannel(null);
    setPlayerMinimized(false);
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT).catch(() => {});
  }

  function renderHeader(title: string) {
    return (
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Text style={styles.backText}>رجوع</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>

        {screen === 'categories' ? (
          <TouchableOpacity onPress={logout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>خروج</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>
    );
  }

  const showExpandedPlayer = activeChannel && !playerMinimized;
  const showMiniPlayer = activeChannel && playerMinimized;

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible
      onRequestClose={goBack}
    >
      {showExpandedPlayer ? (
        <View style={styles.container}>
          <PlayerView
            streamUrl={activeChannel!.url}
            channelName={activeChannel!.name}
            onMinimize={() => setPlayerMinimized(true)}
            onClose={closePlayer}
          />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {screen === 'login' && (
            <View style={styles.flex}>
              {renderHeader('📺 قنوات المباشرة Rabah')}

              <View style={styles.content}>
                <Text style={styles.logo}>📺</Text>
                <Text style={styles.title}>تسجيل الدخول إلى IPTV</Text>
                <Text style={styles.subtitle}>أدخل بيانات Xtream الخاصة بك</Text>

                <TextInput
                  value={server}
                  onChangeText={setServer}
                  placeholder="رابط السيرفر"
                  placeholderTextColor="#7f8da3"
                  autoCapitalize="none"
                  keyboardType="url"
                  style={styles.input}
                />
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="اسم المستخدم"
                  placeholderTextColor="#7f8da3"
                  autoCapitalize="none"
                  style={styles.input}
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="كلمة المرور"
                  placeholderTextColor="#7f8da3"
                  autoCapitalize="none"
                  secureTextEntry
                  style={styles.input}
                />

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => handleLogin()}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>دخول</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {screen === 'categories' && (
            <View style={styles.flex}>
              {renderHeader('📂 فئات القنوات')}

              {loading ? (
                <View style={styles.center}>
                  <ActivityIndicator size="large" color="#ff1e27" />
                  <Text style={styles.loadingText}>جارٍ تحميل الفئات...</Text>
                </View>
              ) : (
                <FlatList
                  data={categories}
                  keyExtractor={(item, index) => String(item.category_id ?? index)}
                  contentContainerStyle={styles.list}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>لا توجد فئات قنوات</Text>
                  }
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.listItem}
                      onPress={() => openCategory(item)}
                    >
                      <Text style={styles.itemIcon}>📂</Text>
                      <Text style={styles.itemText}>{item.category_name}</Text>
                      <Text style={styles.arrow}>‹</Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          )}

          {screen === 'channels' && (
            <View style={styles.flex}>
              {renderHeader(selectedCategory || '📺 القنوات')}

              {loading ? (
                <View style={styles.center}>
                  <ActivityIndicator size="large" color="#ff1e27" />
                  <Text style={styles.loadingText}>جارٍ تحميل القنوات...</Text>
                </View>
              ) : (
                <FlatList
                  data={channels}
                  keyExtractor={(item, index) => String(item.stream_id ?? index)}
                  contentContainerStyle={styles.list}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>لا توجد قنوات في هذه الفئة</Text>
                  }
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.listItem}
                      onPress={() => openChannel(item)}
                    >
                      <Text style={styles.itemIcon}>📺</Text>
                      <Text style={styles.itemText} numberOfLines={2}>
                        {item.name || 'قناة بدون اسم'}
                      </Text>
                      <Text style={styles.playIcon}>▶</Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          )}

          {showMiniPlayer && (
            <MiniPlayer
              streamUrl={activeChannel!.url}
              channelName={activeChannel!.name}
              onExpand={() => setPlayerMinimized(false)}
              onClose={closePlayer}
            />
          )}
        </KeyboardAvoidingView>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220' },
  flex: { flex: 1 },

  header: {
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#161f30',
    borderBottomWidth: 1,
    borderBottomColor: '#273247',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginHorizontal: 8,
  },

  backButton: {
    minWidth: 60,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#26344d',
    alignItems: 'center',
  },

  backText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  closeButton: {
    minWidth: 40,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#7f1d1d',
    alignItems: 'center',
  },

  closeButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  headerSpacer: { width: 60 },

  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#7f1d1d',
  },

  logoutText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  content: { flex: 1, padding: 20, justifyContent: 'center' },

  logo: { textAlign: 'center', fontSize: 52, marginBottom: 10 },

  title: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },

  subtitle: {
    color: '#9aa8bd',
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 24,
  },

  input: {
    backgroundColor: '#161f30',
    borderWidth: 1,
    borderColor: '#2b3850',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 12,
    fontSize: 14,
    textAlign: 'left',
  },

  primaryButton: {
    backgroundColor: '#ff1e27',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },

  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  list: { padding: 12 },

  listItem: {
    minHeight: 64,
    backgroundColor: '#161f30',
    borderWidth: 1,
    borderColor: '#273247',
    borderRadius: 12,
    marginBottom: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },

  itemIcon: { fontSize: 24, width: 40, textAlign: 'center' },

  itemText: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    marginHorizontal: 10,
    textAlign: 'left',
  },

  arrow: { color: '#9aa8bd', fontSize: 28 },

  playIcon: { color: '#ff1e27', fontSize: 18, paddingHorizontal: 8 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  loadingText: { color: '#9aa8bd', marginTop: 12 },

  emptyText: {
    color: '#9aa8bd',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },

  playerContainer: { flex: 1, backgroundColor: '#000' },

  videoContainer: {
    flex: 1,
    width: '100%',
    position: 'relative',
    backgroundColor: '#000',
  },

  videoContainerFullscreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },

  gestureLayerLeft: {
    position: 'absolute',
    left: 0,
    width: '50%',
    top: 60,
    bottom: 0,
    zIndex: 20,
  },

  gestureLayerRight: {
    position: 'absolute',
    right: 0,
    width: '50%',
    top: 0,
    bottom: 60,
    zIndex: 20,
  },

  fullscreenButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    zIndex: 30,
    elevation: 30,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },

  miniBackInFullscreen: {
    position: 'absolute',
    left: 12,
    top: 12,
    zIndex: 30,
    elevation: 30,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },

  fullscreenText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  video: { flex: 1, backgroundColor: '#000' },

  gestureIndicator: {
    position: 'absolute',
    top: '40%',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
  },

  gestureIndicatorLeft: { left: '15%' },
  gestureIndicatorRight: { right: '15%' },

  gestureIndicatorIcon: { fontSize: 26, marginBottom: 4 },

  gestureIndicatorText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

  miniPlayerWrapper: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    zIndex: 50,
  },

  miniPlayerTouchable: {
    width: 160,
    height: 100,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#273247',
    justifyContent: 'flex-end',
  },

  miniPlayerVideo: {
    ...StyleSheet.absoluteFill,
  },

  miniPlayerLabel: {
    color: '#fff',
    fontSize: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 3,
    paddingHorizontal: 6,
  },

  miniPlayerClose: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.75)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  miniPlayerCloseText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
});
