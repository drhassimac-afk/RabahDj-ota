import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';

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

type Category = {
  category_id: string | number;
  category_name: string;
};

type Channel = {
  stream_id: string | number;
  name: string;
  stream_icon?: string;
};

type Screen = 'login' | 'categories' | 'channels' | 'player';

function PlayerView({
  streamUrl,
  channelName,
  onBack,
}: {
  streamUrl: string;
  channelName: string;
  onBack: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);

  const toggleFullscreen = async () => {
    try {
      if (fullscreen) {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT
        );
      } else {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE
        );
      }

      setFullscreen(!fullscreen);
    } catch (error) {
      console.warn('Fullscreen error:', error);
    }
  };

  const player = useVideoPlayer(streamUrl, (p) => {
    p.play();
  });

  return (
    <View style={styles.playerContainer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>رجوع</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {channelName}
        </Text>
      </View>

      <View style={styles.videoContainer}>
        <VideoView
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls
        />

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

export default function YacineNative({ onClose }: YacineNativeProps) {
  const [screen, setScreen] = useState<Screen>('login');
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  const [server, setServer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');

  const [streamUrl, setStreamUrl] = useState('');
  const [channelName, setChannelName] = useState('');

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

      if (!saved) {
        return;
      }

      setServer(saved.server || '');
      setUsername(saved.username || '');
      setPassword(saved.password || '');

      await handleLogin(saved, true);
    } catch {
      // لا نوقف الشاشة إذا لم توجد بيانات محفوظة أو فشل الدخول التلقائي
    }
  }

  async function handleLogin(
    creds?: Credentials,
    silent = false
  ) {
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
        Alert.alert(
          'فشل تسجيل الدخول',
          error?.message || 'تعذر الاتصال بالسيرفر'
        );
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
      Alert.alert(
        'خطأ',
        error?.message || 'تعذر جلب الفئات'
      );
    } finally {
      setLoading(false);
    }
  }

  async function openCategory(category: Category) {
    if (!credentials) {
      return;
    }

    try {
      setLoading(true);
      setSelectedCategory(String(category.category_name));

      const data = await getLiveStreams(
        credentials,
        String(category.category_id)
      );

      setChannels(Array.isArray(data) ? data : []);
      setScreen('channels');
    } catch (error: any) {
      Alert.alert(
        'خطأ',
        error?.message || 'تعذر جلب القنوات'
      );
    } finally {
      setLoading(false);
    }
  }

  function openChannel(channel: Channel) {
    if (!credentials) {
      return;
    }

    const url = getStreamUrl(
      credentials,
      String(channel.stream_id),
      'm3u8'
    );

    setStreamUrl(url);
    setChannelName(channel.name || 'قناة');
    setScreen('player');
  }

  async function logout() {
    await clearCredentials();

    setCredentials(null);
    setCategories([]);
    setChannels([]);
    setSelectedCategory('');
    setStreamUrl('');
    setChannelName('');
    setServer('');
    setUsername('');
    setPassword('');
    setScreen('login');
  }

  function goBack() {
    if (screen === 'player') {
      setScreen('channels');
      return;
    }

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

  if (screen === 'player') {
    return (
      <Modal
        animationType="slide"
        transparent={false}
        visible
        onRequestClose={goBack}
      >
        <View style={styles.container}>
          <PlayerView
            streamUrl={streamUrl}
            channelName={channelName}
            onBack={goBack}
          />
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible
      onRequestClose={goBack}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {screen === 'login' && (
          <View style={styles.flex}>
            {renderHeader('📺 قنوات المباشرة Rabah')}

            <View style={styles.content}>
              <Text style={styles.logo}>📺</Text>

              <Text style={styles.title}>
                تسجيل الدخول إلى IPTV
              </Text>

              <Text style={styles.subtitle}>
                أدخل بيانات Xtream الخاصة بك
              </Text>

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
                  <Text style={styles.primaryButtonText}>
                    دخول
                  </Text>
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
                <Text style={styles.loadingText}>
                  جارٍ تحميل الفئات...
                </Text>
              </View>
            ) : (
              <FlatList
                data={categories}
                keyExtractor={(item, index) =>
                  String(item.category_id ?? index)
                }
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    لا توجد فئات قنوات
                  </Text>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.listItem}
                    onPress={() => openCategory(item)}
                  >
                    <Text style={styles.itemIcon}>📂</Text>
                    <Text style={styles.itemText}>
                      {item.category_name}
                    </Text>
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
                <Text style={styles.loadingText}>
                  جارٍ تحميل القنوات...
                </Text>
              </View>
            ) : (
              <FlatList
                data={channels}
                keyExtractor={(item, index) =>
                  String(item.stream_id ?? index)
                }
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    لا توجد قنوات في هذه الفئة
                  </Text>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.listItem}
                    onPress={() => openChannel(item)}
                  >
                    <Text style={styles.itemIcon}>📺</Text>

                    <Text
                      style={styles.itemText}
                      numberOfLines={2}
                    >
                      {item.name || 'قناة بدون اسم'}
                    </Text>

                    <Text style={styles.playIcon}>▶</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1220',
  },

  flex: {
    flex: 1,
  },

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

  backText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },

  headerSpacer: {
    width: 60,
  },

  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#7f1d1d',
  },

  logoutText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },

  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },

  logo: {
    textAlign: 'center',
    fontSize: 52,
    marginBottom: 10,
  },

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

  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  list: {
    padding: 12,
  },

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

  itemIcon: {
    fontSize: 24,
    width: 40,
    textAlign: 'center',
  },

  itemText: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    marginHorizontal: 10,
    textAlign: 'left',
  },

  arrow: {
    color: '#9aa8bd',
    fontSize: 28,
  },

  playIcon: {
    color: '#ff1e27',
    fontSize: 18,
    paddingHorizontal: 8,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: '#9aa8bd',
    marginTop: 12,
  },

  emptyText: {
    color: '#9aa8bd',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },

  playerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },

  videoContainer: {
    width: '100%',
    height: 240,
    position: 'relative',
    backgroundColor: '#000',
  },

  fullscreenButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },

  fullscreenText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  video: {
    flex: 1,
    backgroundColor: '#000',
  },
});
