import { useKeepAwake } from 'expo-keep-awake';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image,
  ActivityIndicator,
  Alert,
  BackHandler,
  Dimensions,
  useWindowDimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
  PanResponder,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  SafeAreaProvider,
  initialWindowMetrics,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
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
  getVodCategories,
  getVodStreams,
  getVodStreamUrl,
  getShortEpg,
  decodeBase64Text,
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
  container_extension?: string;
};

type Screen = 'login' | 'dashboard' | 'categories' | 'channels' | 'movies-categories' | 'movies-list';

const FAVORITES_STORAGE_KEY = 'rabah_iptv_favorites';
const LAST_WATCHED_STORAGE_KEY = 'rabah_iptv_last_watched';

const DRAWER_ITEM_HEIGHT = 58;

const FIT_MODES = [
  { value: 'contain', label: 'احتواء' },
  { value: 'cover', label: 'ملء' },
  { value: 'fill', label: 'تمديد' },
] as const;

// كاش عام لـ EPG لتجنب إرسال طلب متكرر لنفس القناة
const epgCache = new Map<string, string | null>();

// ============================================================
// عرض اسم البرنامج الحالي لقناة معيّنة (EPG قصير)
// ============================================================
function ChannelEpgLabel({
  channel,
  credentials,
  epgEnabled,
}: {
  channel: Channel;
  credentials: Credentials;
  epgEnabled: boolean;
}) {
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!epgEnabled) {
      setTitle(null);
      return;
    }

    let cancelled = false;
    const key = `${credentials.server}_${credentials.username}_${channel.stream_id}`;

    if (epgCache.has(key)) {
      const cachedTitle = epgCache.get(key);
      if (cachedTitle && !cancelled) {
        setTitle(cachedTitle);
      }
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const data = await getShortEpg(credentials, String(channel.stream_id), 1);
        const listing = data?.epg_listings?.[0];
        const epgTitle = listing?.title
          ? decodeBase64Text(listing.title)
          : null;

        epgCache.set(key, epgTitle);

        if (epgTitle && !cancelled) {
          setTitle(epgTitle);
        }
      } catch {
        // بعض السيرفرات ما عندهاش EPG — نتجاهل بصمت
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [channel.stream_id, credentials, epgEnabled]);

  if (!title) return null;

  return (
    <Text style={styles.epgText} numberOfLines={1}>
      🔴 الآن: {title}
    </Text>
  );
}

// ============================================================
// مشغّل الفيديو (ملء شاشة + تحكم بالسحب بالصوت/الإضاءة + play/pause + تالي/سابق)
// ============================================================
function PlayerView({
  streamUrl,
  channelName,
  onMinimize,
  onClose,
  hasNext,
  hasPrevious,
  onNext,
  onPrevious,
  credentials,
  epgStreamId,
  playlist,
  currentIndex,
  onSelectIndex,
  backRef,
}: {
  streamUrl: string;
  channelName: string;
  onMinimize: () => void;
  onClose: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
  credentials?: Credentials | null;
  epgStreamId?: string;
  playlist?: Channel[];
  currentIndex?: number;
  onSelectIndex?: (index: number) => void;
  backRef?: { current: (() => void) | null };
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const dims = useRef({ width, height });

  useEffect(() => {
    dims.current = { width, height };
  }, [width, height]);

  useKeepAwake();
  const [fullscreen, setFullscreen] = useState(false);
  const fullscreenRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(true);

  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  const [fitIndex, setFitIndex] = useState(0);
  const [brightnessLevel, setBrightnessLevel] = useState(0.5);
  const [volumeLevel, setVolumeLevel] = useState(0.5);

  const contentFit = FIT_MODES[fitIndex].value;

  const toggleLock = () => {
    const next = !lockedRef.current;
    lockedRef.current = next;
    setLocked(next);
  };

  const cycleFit = () => setFitIndex((i) => (i + 1) % FIT_MODES.length);

  const [showChannelList, setShowChannelList] = useState(false);

  const items = playlist ?? [];
  const activeIndex = typeof currentIndex === 'number' ? currentIndex : -1;
  const safeScrollIndex =
    activeIndex >= 0 && activeIndex < items.length ? activeIndex : 0;

const [showControls, setShowControls] = useState(true);
const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

const showControlsTemporarily = () => {
  setShowControls(true);
  if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
  controlsTimeout.current = setTimeout(() => {
    if (fullscreenRef.current && isPlaying) {
      setShowControls(false);
    }
  }, 2500);
};

useEffect(() => {
  if (fullscreenRef.current) {
    showControlsTemporarily();
  } else {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
  }
}, [fullscreen, isPlaying, streamUrl]);

useEffect(() => {
  return () => {
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    if (hideIndicatorTimeout.current) clearTimeout(hideIndicatorTimeout.current);
  };
}, []);
  const [indicator, setIndicator] = useState<{
    type: 'brightness' | 'volume';
    value: number;
  } | null>(null);

  const brightnessStart = useRef(0.5);
  const volumeStart = useRef(0.5);
  const initialBrightness = useRef<number | null>(null);


const currentBrightness = useRef(0.5);

  const currentVolume = useRef(0.5);
  const hideIndicatorTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const player = useVideoPlayer(streamUrl, (p) => {
    p.play();
  });

  const [videoStatus, setVideoStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [videoError, setVideoError] = useState<string | null>(null);
  const streamRetried = useRef(false);

  useEffect(() => {
    streamRetried.current = false;
    setVideoStatus('loading');
    setVideoError(null);

    const subscription = player.addListener('statusChange', (event) => {
      if (event.status === 'readyToPlay') {
        setVideoStatus('ready');
        setVideoError(null);
        return;
      }

      if (event.status === 'loading') {
        setVideoStatus('loading');
        return;
      }

      if (event.status === 'error') {
        const raw = event.error?.message || '';
        const isCleartextError = /CLEARTEXT/i.test(raw);

        const message = isCleartextError
          ? 'الاتصال غير المشفّر (http) ممنوع على هذا الجهاز. يجب تفعيل usesCleartextTraffic وإعادة بناء التطبيق.'
          : raw || 'تعذر تشغيل البث';

        if (
          !isCleartextError &&
          !streamRetried.current &&
          /\.m3u8(?=\?|$)/i.test(streamUrl)
        ) {
          streamRetried.current = true;
          setVideoStatus('loading');
          setVideoError('تعذر تشغيل البث، جارٍ تجربة صيغة بديلة...');

          const fallbackUrl = streamUrl.replace(
            /\.m3u8(\?.*)?$/i,
            '.ts$1'
          );

          player.replace({ uri: fallbackUrl });
          player.play();
          return;
        }

        setVideoStatus('error');
        setVideoError(message);
      }
    });

    return () => subscription.remove();
  }, [player, streamUrl]);

  useEffect(() => {
    setIsPlaying(true);
  }, [streamUrl]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Brightness.requestPermissionsAsync();
        if (status !== 'granted') {
          console.warn('Brightness permission not granted');
        }
      } catch (error) {
        console.warn('Brightness permission request failed:', error);
      }

      try {
        const b = await Brightness.getBrightnessAsync();

        if (initialBrightness.current === null) {
          initialBrightness.current = b;
        }

        currentBrightness.current = b;
        setBrightnessLevel(b);
      } catch {
        // تجاهل لو ما فيه صلاحية
      }
      try {
        const v = await VolumeManager.getVolume();
        const volNum = typeof v === 'number' ? v : (v as any)?.volume ?? 0.5;
        currentVolume.current = volNum;
        setVolumeLevel(volNum);
      } catch {
        // تجاهل
      }
    })();

    VolumeManager.showNativeVolumeUI({ enabled: false });

    return () => {
        VolumeManager.showNativeVolumeUI({ enabled: true });
        if (hideIndicatorTimeout.current) clearTimeout(hideIndicatorTimeout.current);

        if (initialBrightness.current !== null) {
          Brightness.setBrightnessAsync(initialBrightness.current).catch(() => {});
        }

        NavBar.setVisibilityAsync('visible').catch(() => {});
        ScreenOrientation.unlockAsync().catch(() => {});
      };
  }, []);
  const backActionRef = useRef<() => void>(() => {});

  backActionRef.current = () => {
    if (lockedRef.current) {
      showControlsTemporarily();
      return;
    }

    if (fullscreenRef.current) {
      void toggleFullscreen();
      return;
    }

    void minimizePlayer();
  };

  useEffect(() => {
    if (!backRef) return;

    backRef.current = () => backActionRef.current();

    return () => {
      backRef.current = null;
    };
  }, [backRef]);



  const toggleFullscreen = async () => {
    const nextFullscreen = !fullscreenRef.current;

    fullscreenRef.current = nextFullscreen;
    setFullscreen(nextFullscreen);

    try {
      if (nextFullscreen) {
        NavBar.setVisibilityAsync('hidden').catch(() => {});

        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE
        );
      } else {
        NavBar.setVisibilityAsync('visible').catch(() => {});

        await ScreenOrientation.unlockAsync();
      }
    } catch (error) {
      console.warn('Fullscreen orientation error:', error);
    }
  };
const minimizePlayer = async () => {
    try {
      if (fullscreenRef.current) {
        fullscreenRef.current = false;
        setFullscreen(false);
        NavBar.setVisibilityAsync('visible').catch(() => {});
        await ScreenOrientation.unlockAsync();
      }
    } catch (error) {
      console.warn('Minimize orientation error:', error);
    }

    onMinimize();
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  };

  const showIndicator = (type: 'brightness' | 'volume', value: number) => {
    if (type === 'brightness') {
      setBrightnessLevel(value);
    } else {
      setVolumeLevel(value);
    }

    setIndicator({ type, value });

    if (hideIndicatorTimeout.current) clearTimeout(hideIndicatorTimeout.current);
    hideIndicatorTimeout.current = setTimeout(() => setIndicator(null), 700);
  };

  // نصف الشاشة الأيسر: إضاءة — نصف الشاشة الأيمن: صوت
  const touchStartX = useRef(0);

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .onBegin((e) => {
      showControlsTemporarily();
      touchStartX.current = e.x;
      brightnessStart.current = currentBrightness.current;
      volumeStart.current = currentVolume.current;
    })
    .onUpdate((e) => {
      if (lockedRef.current || !fullscreenRef.current) return;

      const { width, height } = dims.current;
      const delta = -e.translationY / height;

      if (touchStartX.current < width / 2) {
        let next = brightnessStart.current + delta;
        next = Math.max(0, Math.min(1, next));
        currentBrightness.current = next;
        Brightness.setBrightnessAsync(next).catch(() => {});
        showIndicator('brightness', next);
      } else {
        let next = volumeStart.current + delta;
        next = Math.max(0, Math.min(1, next));
        currentVolume.current = next;
        VolumeManager.setVolume(next);
        showIndicator('volume', next);
      }
    })
    .minDistance(8);

  const tapGesture = Gesture.Tap()
    .runOnJS(true)
    .onEnd(() => {
      if (lockedRef.current) {
        showControlsTemporarily();
        return;
      }

      if (fullscreenRef.current) {
        if (showControls) {
          if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
          setShowControls(false);
        } else {
          showControlsTemporarily();
        }
      }
    });

  const videoGestures = Gesture.Exclusive(tapGesture, panGesture);


  return (
    <View style={styles.playerContainer}>
      {fullscreen && <StatusBar hidden />}

      {!fullscreen && (
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={minimizePlayer} style={styles.backButton}>
            <Text style={styles.backText}>تصغير ▾</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle} numberOfLines={1}>
            {channelName}
          </Text>

          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <View
        style={[
          styles.videoContainer,
          fullscreen && styles.videoContainerFullscreen,
        ]}
      >
        <VideoView
          player={player}
          style={styles.video}
          contentFit={contentFit}
          nativeControls={false}
          pointerEvents="none"
          surfaceType="textureView"
        />

        {videoStatus === 'loading' && (
          <View style={styles.videoMessageOverlay} pointerEvents="none">
            <ActivityIndicator size="large" />
            <Text style={styles.videoMessageText}>
              {videoError || 'جارٍ تحميل البث...'}
            </Text>
          </View>
        )}

        {videoStatus === 'error' && (
          <View style={styles.videoMessageOverlay}>
            <Text style={styles.videoErrorIcon}>⚠️</Text>
            <Text style={styles.videoMessageText}>
              {videoError || 'تعذر تشغيل البث'}
            </Text>

            <TouchableOpacity
              style={styles.videoRetryButton}
              onPress={() => {
                streamRetried.current = false;
                setVideoStatus('loading');
                setVideoError(null);
                player.replace({ uri: streamUrl });
                player.play();
              }}
            >
              <Text style={styles.videoRetryText}>إعادة المحاولة</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* طبقة السحب شفافة منفصلة فوق الفيديو — gesture-handler يلتقط اللمسة قبل أي native surface */}
        <GestureDetector gesture={videoGestures}>
          <View style={StyleSheet.absoluteFill} />
        </GestureDetector>

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

        {fullscreen && showControls && !locked && (
          <View
            style={[
              styles.fsTopBar,
              {
                paddingTop: insets.top + 8,
                paddingLeft: 12 + insets.left,
                paddingRight: 12 + insets.right,
              },
            ]}
          >
            <TouchableOpacity style={styles.fsTopButton} onPress={minimizePlayer}>
              <Text style={styles.fsTopButtonText}>▾</Text>
            </TouchableOpacity>

            <Text style={styles.fsTitle} numberOfLines={1}>
              {channelName}
            </Text>

            <HeaderClock />

            <TouchableOpacity style={styles.fsTopButton} onPress={cycleFit}>
              <Text style={styles.fsTopButtonText}>
                {FIT_MODES[fitIndex].label}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.fsTopButton} onPress={toggleLock}>
              <Text style={styles.fsTopButtonText}>🔓</Text>
            </TouchableOpacity>
          </View>
        )}

        {fullscreen && locked && showControls && (
          <TouchableOpacity
            style={[styles.lockBadge, { top: insets.top + 12 }]}
            onPress={toggleLock}
          >
            <Text style={styles.lockBadgeText}>🔒 اضغط لفتح القفل</Text>
          </TouchableOpacity>
        )}

        {showControls && !locked && (
          <TouchableOpacity
            style={[
              styles.fullscreenButton,
              {
                right: 12 + insets.right,
                bottom: 108 + insets.bottom,
              },
            ]}
            onPress={toggleFullscreen}
          >
            <Text style={styles.fullscreenText}>
              {fullscreen ? '⛶ خروج' : '⛶ ملء الشاشة'}
            </Text>
          </TouchableOpacity>
        )}

        {fullscreen && showControls && !locked && (
          <>
            <View
              style={[styles.sideSlider, { left: 20 + insets.left }]}
              pointerEvents="none"
            >
              <Text style={styles.sideIcon}>☀️</Text>
              <View style={styles.sliderTrack}>
                <View
                  style={[
                    styles.sliderFill,
                    { height: `${Math.round(brightnessLevel * 100)}%` },
                  ]}
                />
              </View>
            </View>

            <View
              style={[styles.sideSlider, { right: 20 + insets.right }]}
              pointerEvents="none"
            >
              <Text style={styles.sideIcon}>🔊</Text>
              <View style={styles.sliderTrack}>
                <View
                  style={[
                    styles.sliderFill,
                    { height: `${Math.round(volumeLevel * 100)}%` },
                  ]}
                />
              </View>
            </View>
          </>
        )}

        {showChannelList && (
          <View style={styles.drawerOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setShowChannelList(false)}
            />

            <View
              style={[
                styles.channelDrawer,
                {
                  right: insets.right,
                  paddingTop: insets.top + 12,
                  paddingBottom: insets.bottom + 12,
                },
              ]}
            >
              <View style={styles.drawerHeader}>
                <Text style={styles.drawerTitle}>
                  القنوات ({items.length})
                </Text>

                <TouchableOpacity onPress={() => setShowChannelList(false)}>
                  <Text style={styles.drawerCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={items}
                keyExtractor={(item, index) => String(item.stream_id ?? index)}
                initialScrollIndex={safeScrollIndex}
                getItemLayout={(_data, index) => ({
                  length: DRAWER_ITEM_HEIGHT,
                  offset: DRAWER_ITEM_HEIGHT * index,
                  index,
                })}
                initialNumToRender={14}
                maxToRenderPerBatch={10}
                windowSize={7}
                renderItem={({ item, index }) => {
                  const isActive = index === activeIndex;

                  return (
                    <TouchableOpacity
                      style={[
                        styles.drawerItem,
                        isActive && styles.drawerItemActive,
                      ]}
                      onPress={() => {
                        onSelectIndex?.(index);
                        setShowChannelList(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.drawerNumber,
                          isActive && styles.drawerTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {item.stream_id}
                      </Text>

                      {item.stream_icon ? (
                        <Image
                          source={{ uri: item.stream_icon }}
                          style={styles.drawerLogo}
                        />
                      ) : (
                        <View style={styles.drawerLogo} />
                      )}

                      <Text
                        style={[
                          styles.drawerName,
                          isActive && styles.drawerTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>

                      {isActive && <Text style={styles.drawerPlaying}>▶</Text>}
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </View>
        )}

        {showControls && !locked && credentials && epgStreamId ? (
          <PlayerEpgBar
            credentials={credentials}
            streamId={epgStreamId}
            bottomOffset={92 + insets.bottom}
          />
        ) : null}

        {/* أزرار التحكم السفلية: سابق / تشغيل-إيقاف / تالي */}
        {showControls && !locked && (
          <View
            style={[
              styles.controlsBar,
              { bottom: 32 + insets.bottom },
            ]}
          >
          {items.length > 0 && (
            <TouchableOpacity
              style={[styles.controlButton, styles.drawerToggle]}
              onPress={() => setShowChannelList(true)}
            >
              <Text style={styles.controlButtonText}>☰</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.controlButton, !hasPrevious && styles.controlButtonDisabled]}
            onPress={onPrevious}
            disabled={!hasPrevious}
          >
            <Text style={styles.controlButtonText}>⏮</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButtonPlay} onPress={togglePlayPause}>
            <Text style={styles.controlButtonText}>{isPlaying ? '⏸' : '▶'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, !hasNext && styles.controlButtonDisabled]}
            onPress={onNext}
            disabled={!hasNext}
          >
            <Text style={styles.controlButtonText}>⏭</Text>
          </TouchableOpacity>
        </View>
        )}
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
  const { width, height } = useWindowDimensions();
  useKeepAwake();
  const insets = useSafeAreaInsets();

  const player = useVideoPlayer(streamUrl, (p) => {
    p.play();
  });

  const pan = useRef(new Animated.ValueXY({ x: -16, y: -24 })).current;
  const current = useRef({ x: -16, y: -24 });
  const start = useRef({ x: -16, y: -24 });
  const screen = useRef({ width, height });
  const onExpandRef = useRef(onExpand);

  useEffect(() => {
    screen.current = { width, height };
  }, [width, height]);

  useEffect(() => {
    onExpandRef.current = onExpand;
  }, [onExpand]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: () => {
        start.current = { ...current.current };
      },

      onPanResponderMove: (_evt, g) => {
        const { width: w, height: h } = screen.current;

        const x = Math.max(
          -(w - 180),
          Math.min(4, start.current.x + g.dx)
        );

        const y = Math.max(
          -(h - 180),
          Math.min(24, start.current.y + g.dy)
        );

        current.current = { x, y };
        pan.setValue({ x, y });
      },

      onPanResponderRelease: (_evt, g) => {
        // لمسة قصيرة بدون سحب = تكبير المشغل
        if (Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6) {
          onExpandRef.current();
        }
      },
    })
  ).current;

  return (
    <Animated.View
      style={[
        styles.miniPlayerWrapper,
        {
          bottom: 32 + insets.bottom,
          transform: pan.getTranslateTransform(),
        },
      ]}
    >
      <View
        style={styles.miniPlayerTouchable}
        {...panResponder.panHandlers}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <VideoView
            player={player}
            style={styles.miniPlayerVideo}
            contentFit="cover"
            nativeControls={false}
            surfaceType="textureView"
          />
        </View>

        <Text style={styles.miniPlayerLabel} numberOfLines={1}>
          {channelName}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.miniPlayerClose}
        onPress={onClose}
      >
        <Text style={styles.miniPlayerCloseText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ============================================================
// ترويسات تحترم المنطقة الآمنة
// ============================================================
function HeaderClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={styles.clockBox}>
      <Text style={styles.clockTime}>
        {now.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>
      <Text style={styles.clockDate}>
        {now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
      </Text>
    </View>
  );
}

function PlayerEpgBar({
  credentials,
  streamId,
  bottomOffset,
}: {
  credentials: Credentials;
  streamId: string;
  bottomOffset: number;
}) {
  const [items, setItems] = useState<
    { title: string; start: number; end: number }[]
  >([]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await getShortEpg(credentials, streamId, 4);
        const list = (data?.epg_listings || [])
          .map((l: any) => ({
            title: decodeBase64Text(l.title),
            start: Number(l.start_timestamp) * 1000,
            end: Number(l.stop_timestamp ?? l.end_timestamp) * 1000,
          }))
          .filter(
            (x: { title: string; start: number; end: number }) =>
              x.title && Number.isFinite(x.start) && Number.isFinite(x.end)
          )
          .sort((a: { start: number }, b: { start: number }) => a.start - b.start);

        if (!cancelled) setItems(list);
      } catch {
        if (!cancelled) setItems([]);
      }
    };

    setItems([]);
    load();
    const id = setInterval(load, 60000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [streamId, credentials]);

  const current = items.find((x) => x.start <= nowMs && nowMs < x.end);
  const next = items.find((x) => x.start > nowMs);

  if (!current && !next) return null;

  const progress =
    current && current.end > current.start
      ? Math.min(1, Math.max(0, (nowMs - current.start) / (current.end - current.start)))
      : 0;

  return (
    <View style={[styles.epgBar, { bottom: bottomOffset }]} pointerEvents="none">
      {current && (
        <Text style={styles.epgNow} numberOfLines={1}>
          🔴 الآن: {current.title}
        </Text>
      )}

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.round(progress * 100)}%` },
          ]}
        />
      </View>

      {next && (
        <Text style={styles.epgNext} numberOfLines={1}>
          ⏭ التالي: {next.title}
        </Text>
      )}
    </View>
  );
}

function ScreenHeader({
  title,
  onBack,
  onLogout,
}: {
  title: string;
  onBack: () => void;
  onLogout?: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>رجوع</Text>
      </TouchableOpacity>

      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>

      {onLogout ? (
        <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>خروج</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ width: 60 }} />
      )}
    </View>
  );
}

function DashboardHeader({ onLogout }: { onLogout: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.dashboardHeader, { paddingTop: insets.top + 10 }]}>
      <Text style={styles.dashboardBrand}>📺 RABAH TV</Text>

      <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
        <Text style={styles.logoutText}>خروج</Text>
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
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<Channel[]>([]);
  const [lastWatched, setLastWatched] = useState<Channel | null>(null);
  const [movieCategories, setMovieCategories] = useState<CategoryItem[]>([]);
  const [movies, setMovies] = useState<Channel[]>([]);
  const [movieSearchQuery, setMovieSearchQuery] = useState('');
  const [selectedMovieCategory, setSelectedMovieCategory] = useState('');

  const [activeChannel, setActiveChannel] = useState<{
    url: string;
    name: string;
    index: number;
    source: 'live' | 'movie';
    streamId: string;
  } | null>(null);
  const [playerMinimized, setPlayerMinimized] = useState(false);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    ScreenOrientation.unlockAsync().catch(() => {});

    loadSavedCredentials();
    loadFavorites();
    loadLastWatched();
return () => {
      ScreenOrientation.unlockAsync().catch(() => {});
    };
  }, []);

  async function loadFavorites() {
    try {
      const raw = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
      if (raw) {
        setFavorites(JSON.parse(raw));
      }
    } catch {
      // تجاهل
    }
  }

  const toggleFavorite = useCallback(async (channel: Channel) => {
    setFavorites((prev) => {
      const exists = prev.some((c) => String(c.stream_id) === String(channel.stream_id));
      const next = exists
        ? prev.filter((c) => String(c.stream_id) !== String(channel.stream_id))
        : [...prev, channel];
      AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const favoriteIds = React.useMemo(
    () => new Set(favorites.map((c) => String(c.stream_id))),
    [favorites]
  );

  function isFavorite(channel: Channel) {
    return favoriteIds.has(String(channel.stream_id));
  }

  function openFavorites() {
    setChannels(favorites);
    setSelectedCategory('⭐ المفضلة');
    setSearchQuery('');
    setScreen('channels');
  }

  async function loadLastWatched() {
    try {
      const raw = await AsyncStorage.getItem(LAST_WATCHED_STORAGE_KEY);
      if (raw) {
        setLastWatched(JSON.parse(raw));
      }
    } catch {
      // تجاهل
    }
  }

  function resumeLastWatched() {
    if (!credentials || !lastWatched) return;

    const index = channels.findIndex(
      (c) => String(c.stream_id) === String(lastWatched.stream_id)
    );

    const url = getStreamUrl(
      credentials,
      String(lastWatched.stream_id),
      'm3u8'
    );

    setActiveChannel({
      url,
      name: lastWatched.name || 'قناة',
      index: index >= 0 ? index : -1,
      source: 'live',
      streamId: String(lastWatched.stream_id),
    });

    setPlayerMinimized(false);
  }

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
      setScreen('dashboard');
    } catch (error: any) {
      Alert.alert('خطأ', error?.message || 'تعذر جلب الفئات');
    } finally {
      setLoading(false);
    }
  }

  const openCategory = useCallback(async (category: CategoryItem) => {
    if (!credentials) return;

    try {
      setLoading(true);
      setSelectedCategory(String(category.category_name));

      const data = await getLiveStreams(credentials, String(category.category_id));
      setChannels(Array.isArray(data) ? data : []);
      setSearchQuery('');
      setScreen('channels');
    } catch (error: any) {
      Alert.alert('خطأ', error?.message || 'تعذر جلب القنوات');
    } finally {
      setLoading(false);
    }
  }, [credentials]);

  function playChannelAtIndex(index: number) {
    if (!credentials) return;
    const channel = channels[index];
    if (!channel) return;

    const url = getStreamUrl(credentials, String(channel.stream_id), 'm3u8');
    setActiveChannel({
      url,
      name: channel.name || 'قناة',
      index,
      source: 'live',
      streamId: String(channel.stream_id),
    });

    setLastWatched(channel);
    AsyncStorage.setItem(
      LAST_WATCHED_STORAGE_KEY,
      JSON.stringify(channel)
    ).catch(() => {});
  }

  const openChannel = useCallback((channel: Channel) => {
    if (!credentials) return;

    const index = channels.findIndex((c) => String(c.stream_id) === String(channel.stream_id));
    const url = getStreamUrl(credentials, String(channel.stream_id), 'm3u8');

    // تجنب إعادة تشغيل نفس القناة إذا كانت مفتوحة بالفعل
    if (activeChannel?.url === url && !playerMinimized) return;

    setActiveChannel({
      url,
      name: channel.name || 'قناة',
      index,
      source: 'live',
      streamId: String(channel.stream_id),
    });
    setPlayerMinimized(false);

    setLastWatched(channel);
    AsyncStorage.setItem(LAST_WATCHED_STORAGE_KEY, JSON.stringify(channel)).catch(() => {});
  }, [credentials, channels, activeChannel, playerMinimized]);

  async function openMovieCategories() {
    if (!credentials) return;
    try {
      setLoading(true);
      const data = await getVodCategories(credentials);
      setMovieCategories(Array.isArray(data) ? data : []);
      setScreen('movies-categories');
    } catch (error: any) {
      Alert.alert('خطأ', error?.message || 'تعذر جلب فئات الأفلام');
    } finally {
      setLoading(false);
    }
  }

  async function openMovieCategory(category: CategoryItem) {
    if (!credentials) return;
    try {
      setLoading(true);
      setSelectedMovieCategory(String(category.category_name));
      const data = await getVodStreams(credentials, String(category.category_id));
      setMovies(Array.isArray(data) ? data : []);
      setScreen('movies-list');
    } catch (error: any) {
      Alert.alert('خطأ', error?.message || 'تعذر جلب الأفلام');
    } finally {
      setLoading(false);
    }
  }

  function playMovieAtIndex(index: number) {
    if (!credentials) return;
    const movie = movies[index];
    if (!movie) return;

    const url = getVodStreamUrl(credentials, movie.stream_id, movie.container_extension || 'mp4');
    setActiveChannel({
      url,
      name: movie.name || 'فيلم',
      index,
      source: 'movie',
      streamId: String(movie.stream_id),
    });
  }

  function openMovie(movie: Channel) {
    if (!credentials) return;
    const index = movies.findIndex((m) => String(m.stream_id) === String(movie.stream_id));
    const url = getVodStreamUrl(credentials, movie.stream_id, movie.container_extension || 'mp4');
    setActiveChannel({
      url,
      name: movie.name || 'فيلم',
      index,
      source: 'movie',
      streamId: String(movie.stream_id),
    });
    setPlayerMinimized(false);
  }

  function goToNextChannel() {
    if (!activeChannel) return;
    if (activeChannel.source === 'movie') {
      if (activeChannel.index < movies.length - 1) {
        playMovieAtIndex(activeChannel.index + 1);
      }
    } else if (activeChannel.index < channels.length - 1) {
      playChannelAtIndex(activeChannel.index + 1);
    }
  }

  function goToPreviousChannel() {
    if (!activeChannel) return;
    if (activeChannel.index > 0) {
      if (activeChannel.source === 'movie') {
        playMovieAtIndex(activeChannel.index - 1);
      } else {
        playChannelAtIndex(activeChannel.index - 1);
      }
    }
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
      if (activeChannel) {
        closePlayer();
        return;
      }
    if (screen === 'channels') {
      setScreen('categories');
      return;
    }
    if (screen === 'movies-list') {
      setScreen('movies-categories');
      return;
    }
    if (screen === 'categories' || screen === 'movies-categories') {
      setScreen('dashboard');
      return;
    }
    onClose();
  }

  const lastBackAt = useRef(0);
  const playerBackRef = useRef<(() => void) | null>(null);

  function handleHardwareBack() {
    const now = Date.now();

    if (now - lastBackAt.current < 250) return;
    lastBackAt.current = now;

    if (activeChannel && !playerMinimized) {
      if (playerBackRef.current) {
        playerBackRef.current();
      } else {
        setPlayerMinimized(true);
      }
      return;
    }

    goBack();
  }

  const hardwareBackRef = useRef(handleHardwareBack);
  hardwareBackRef.current = handleHardwareBack;

  useEffect(() => {
    const sub = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        hardwareBackRef.current();
        return true;
      }
    );

    return () => sub.remove();
  }, []);


  function closePlayer() {
    setActiveChannel(null);
    setPlayerMinimized(false);
      NavBar.setVisibilityAsync('visible').catch(() => {});
    ScreenOrientation.unlockAsync().catch(() => {});
  }

  function renderHeader(title: string) {
    return (
      <ScreenHeader
        title={title}
        onBack={goBack}
        onLogout={screen === 'categories' ? logout : undefined}
      />
    );
  }

  const [visibleEpgIds, setVisibleEpgIds] = useState<Set<string>>(
    () => new Set()
  );

  const onChannelsViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ item: Channel }> }) => {
      const next = new Set<string>();

      for (const viewable of viewableItems) {
        if (viewable?.item?.stream_id != null) {
          next.add(String(viewable.item.stream_id));
        }
      }

      // حذف EPG للقنوات التي خرجت من النطاق المرئي
      if (credentials) {
        const prefix = `${credentials.server}_${credentials.username}_`;

        for (const key of epgCache.keys()) {
          if (!key.startsWith(prefix)) continue;

          const streamId = key.slice(prefix.length);
          if (!next.has(streamId)) {
            epgCache.delete(key);
          }
        }
      }

      setVisibleEpgIds(next);
    },
    [credentials]
  );

  const channelsViewabilityConfig = React.useMemo(
    () => ({
      itemVisiblePercentThreshold: 20,
    }),
    []
  );

  const filteredChannels = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return channels;

    return channels.filter((c) =>
      (c.name || '').toLowerCase().includes(q)
    );
  }, [channels, searchQuery]);

  const showExpandedPlayer = activeChannel && !playerMinimized;
  const showMiniPlayer = activeChannel && playerMinimized;

  const filteredMovies = movies.filter((movie: Channel) =>
    (movie.name || '').toLowerCase().includes(movieSearchQuery.toLowerCase())
  );


  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible
      onRequestClose={() => hardwareBackRef.current()}
    >
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <GestureHandlerRootView style={{ flex: 1 }}>

      {showExpandedPlayer ? (
        <View style={styles.container}>
          <PlayerView
            streamUrl={activeChannel!.url}
            channelName={activeChannel!.name}
            onMinimize={() => setPlayerMinimized(true)}
            backRef={playerBackRef}
            onClose={closePlayer}
            hasNext={
              activeChannel!.source === 'movie'
                ? activeChannel!.index < movies.length - 1
                : activeChannel!.index < channels.length - 1
            }
            hasPrevious={activeChannel!.index > 0}
            onNext={goToNextChannel}
            onPrevious={goToPreviousChannel}
            credentials={credentials}
            epgStreamId={
              activeChannel!.source === 'live' ? activeChannel!.streamId : ''
            }
            playlist={activeChannel!.source === 'movie' ? movies : channels}
            currentIndex={activeChannel!.index}
            onSelectIndex={(i) => {
              if (activeChannel!.source === 'movie') {
                playMovieAtIndex(i);
              } else {
                playChannelAtIndex(i);
              }
            }}
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

          {screen === 'dashboard' && (
            <View style={styles.flex}>
              <DashboardHeader onLogout={logout} />

              <View style={styles.dashboardGrid}>
                {lastWatched && (
                  <TouchableOpacity style={styles.resumeCard} onPress={resumeLastWatched}>
                    <Text style={styles.resumeIcon}>▶</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resumeLabel}>متابعة المشاهدة</Text>
                      <Text style={styles.resumeChannelName} numberOfLines={1}>
                        {lastWatched.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.dashboardCardLarge, { backgroundColor: '#1f8a5c' }]}
                  onPress={() => setScreen('categories')}
                >
                  <Text style={styles.dashboardCardIcon}>📡</Text>
                  <Text style={styles.dashboardCardTitle}>TV مباشر</Text>
                </TouchableOpacity>

                <View style={styles.dashboardRow}>
                  <TouchableOpacity
                    style={[styles.dashboardCardSmall, { backgroundColor: '#c0392b' }]}
                    onPress={openMovieCategories}
                  >
                    <Text style={styles.dashboardCardIcon}>🎬</Text>
                    <Text style={styles.dashboardCardTitle}>أفلام</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dashboardCardSmall, { backgroundColor: '#6c3fa8' }]}
                    onPress={() => Alert.alert('قريبًا 🔜', 'قسم المسلسلات قيد التطوير')}
                  >
                    <Text style={styles.dashboardCardIcon}>🎞️</Text>
                    <Text style={styles.dashboardCardTitle}>مسلسلات</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.dashboardCardTiny}
                  onPress={() => Alert.alert('قريبًا 🔜', 'دليل البرامج (EPG) قيد التطوير')}
                >
                  <Text style={styles.dashboardCardTinyIcon}>📖</Text>
                  <Text style={styles.dashboardCardTinyText}>مباشر مع EPG</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dashboardCardTiny}
                  onPress={() => Alert.alert('قريبًا 🔜', 'ميزة الشاشات المتعددة قيد التطوير')}
                >
                  <Text style={styles.dashboardCardTinyIcon}>▦</Text>
                  <Text style={styles.dashboardCardTinyText}>شاشات متعددة</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dashboardCardTiny}
                  onPress={() => Alert.alert('قريبًا 🔜', 'ميزة الرتراباج قيد التطوير')}
                >
                  <Text style={styles.dashboardCardTinyIcon}>🕐</Text>
                  <Text style={styles.dashboardCardTinyText}>رتراباج</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.dashboardFooter}>متصل: {username}</Text>
            </View>
          )}

          {screen === 'categories' && (
            <View style={styles.flex}>
              {renderHeader('📂 فئات القنوات')}

              <TouchableOpacity style={styles.favoritesRow} onPress={openFavorites}>
                <Text style={styles.itemIcon}>⭐</Text>
                <Text style={styles.itemText}>المفضلة ({favorites.length})</Text>
                <Text style={styles.arrow}>‹</Text>
              </TouchableOpacity>

              {loading ? (
                <View style={styles.center}>
                  <ActivityIndicator size="large" color="#ff1e27" />
                  <Text style={styles.loadingText}>جارٍ تحميل الفئات...</Text>
                </View>
              ) : (
        

        <FlatList<CategoryItem>
                  data={categories}
                  keyExtractor={(item, index) => String(item.category_id ?? index)}
                  removeClippedSubviews={Platform.OS === 'android'}
                  initialNumToRender={15}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                  updateCellsBatchingPeriod={40}
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

          {screen === 'movies-categories' && (
            <View style={styles.flex}>
              {renderHeader('🎬 فئات الأفلام')}

              {loading ? (
                <View style={styles.center}>
                  <ActivityIndicator size="large" color="#ff1e27" />
                  <Text style={styles.loadingText}>جارٍ تحميل الفئات...</Text>
                </View>
              ) : (
                <FlatList
                  data={movieCategories}
                  keyExtractor={(item, index) => String(item.category_id ?? index)}
                  removeClippedSubviews={Platform.OS === 'android'}
                  initialNumToRender={15}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                  updateCellsBatchingPeriod={40}
                  contentContainerStyle={styles.list}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>لا توجد فئات أفلام</Text>
                  }
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.listItem}
                      onPress={() => openMovieCategory(item)}
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

          {screen === 'movies-list' && (
            <View style={styles.flex}>
              {renderHeader(selectedMovieCategory || '🎬 أفلام')}
                  
                  <TextInput
                    value={movieSearchQuery}
                    onChangeText={setMovieSearchQuery}
                    placeholder="ابحث عن فيلم..."
                    placeholderTextColor="#888"
                    style={{
                      backgroundColor: '#222',
                      color: '#fff',
                      borderRadius: 10,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      marginHorizontal: 12,
                      marginBottom: 10,
                    }}
                  />

              {loading ? (
                <View style={styles.center}>
                  <ActivityIndicator size="large" color="#ff1e27" />
                  <Text style={styles.loadingText}>جارٍ تحميل الأفلام...</Text>
                </View>
              ) : (




                <FlatList
                  data={filteredMovies}
                  keyExtractor={(item, index) => String(item.stream_id ?? index)}
                  removeClippedSubviews={Platform.OS === 'android'}
                  initialNumToRender={15}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                  updateCellsBatchingPeriod={40}
                  contentContainerStyle={styles.list}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>لا توجد أفلام فـ هذه الفئة</Text>
                  }
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.listItem}
                      onPress={() => openMovie(item)}
                    >
                      {item.stream_icon ? (
                        <Image
                          source={{ uri: item.stream_icon }}
                          style={styles.channelLogo}
                        />
                      ) : (
                        <Text style={styles.itemIcon}>🎬</Text>
                      )}
                      <Text style={styles.itemText} numberOfLines={2}>
                        {item.name || 'فيلم بدون اسم'}
                      </Text>
                      <Text style={styles.playIcon}>▶</Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          )}

          {screen === 'channels' && (
            <View style={styles.flex}>
              {renderHeader(selectedCategory || ' 📺 القنوات')}

              <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="ابحث عن قناة..."
                  placeholderTextColor="#7f8da3"
                  style={styles.searchInput}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Text style={styles.searchClear}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {loading ? (
                <View style={styles.center}>
                  <ActivityIndicator size="large" color="#ff1e27" />
                  <Text style={styles.loadingText}>جارٍ تحميل القنوات...</Text>
                </View>
              ) : (
                <FlatList
                  data={filteredChannels}
                  keyExtractor={(item, index) => String(item.stream_id ?? index)}
                  removeClippedSubviews={Platform.OS === 'android'}
                  initialNumToRender={15}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                  updateCellsBatchingPeriod={40}
                  onViewableItemsChanged={onChannelsViewableItemsChanged}
                  viewabilityConfig={channelsViewabilityConfig}
                  contentContainerStyle={styles.list}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>
                      {searchQuery ? 'لا توجد نتائج مطابقة' : 'لا توجد قنوات في هذه الفئة'}
                    </Text>
                  }
                  renderItem={({ item }) => (
                    <View style={styles.listItem}>
                      <TouchableOpacity
                        onPress={() => toggleFavorite(item)}
                        style={styles.favoriteStarButton}
                      >
                        <Text style={styles.favoriteStarText}>
                          {isFavorite(item) ? '⭐' : '☆'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.listItemContent}
                        onPress={() => openChannel(item)}
                      >
                        {item.stream_icon ? (
                        <Image
                          source={{ uri: item.stream_icon }}
                          style={styles.channelLogo}
                        />
                      ) : (
                        <Text style={styles.itemIcon}>📺</Text>
                      )}
                        <View style={{ flex: 1, marginHorizontal: 10 }}>
                          <Text style={styles.itemText} numberOfLines={1}>
                            {item.name || 'قناة بدون اسم'}
                          </Text>
                          {credentials && (
                            <ChannelEpgLabel
                              channel={item}
                              credentials={credentials}
                              epgEnabled={visibleEpgIds.has(String(item.stream_id))}
                            />
                          )}
                        </View>
                        <Text style={styles.playIcon}>▶</Text>
                      </TouchableOpacity>
                    </View>
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
          </GestureHandlerRootView>
      </SafeAreaProvider>
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

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161f30',
    borderWidth: 1,
    borderColor: '#2b3850',
    borderRadius: 10,
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 12,
    height: 44,
  },

  searchIcon: { fontSize: 15, marginEnd: 8 },

  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    textAlign: 'left',
  },

  searchClear: { color: '#9aa8bd', fontSize: 16, paddingHorizontal: 4 },

  list: { padding: 12, paddingBottom: 56 },
  favoritesRow: {
    minHeight: 56,
    backgroundColor: '#26344d',
    borderWidth: 1,
    borderColor: '#3a4a68',
    borderRadius: 12,
    marginHorizontal: 12,
    marginTop: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },

  listItem: {
    minHeight: 64,
    backgroundColor: '#161f30',
    borderWidth: 1,
    borderColor: '#273247',
    borderRadius: 12,
    marginBottom: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },

  listItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },

  favoriteStarButton: {
    width: 40,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  favoriteStarText: { fontSize: 20 },

  channelLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#26344d',
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

  dashboardHeader: {
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#161f30',
    borderBottomWidth: 1,
    borderBottomColor: '#273247',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  dashboardBrand: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  dashboardGrid: { padding: 16 },

  dashboardCardLarge: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    minHeight: 140,
  },

  dashboardRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
  },

  dashboardCardSmall: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 110,
  },

  dashboardCardTiny: {
    backgroundColor: '#2c8a6d',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  dashboardCardTinyIcon: { fontSize: 20, marginEnd: 10 },

  dashboardCardTinyText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  dashboardCardIcon: { fontSize: 34, marginBottom: 8 },

  dashboardCardTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  dashboardFooter: {
    color: '#9aa8bd',
    textAlign: 'center',
    fontSize: 12,
    marginTop: 8,
  },

  epgText: {
    color: '#8fd3a8',
    fontSize: 11,
    marginTop: 2,
  },

  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#26344d',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#3a4a68',
  },

  resumeIcon: {
    fontSize: 22,
    color: '#ff1e27',
    marginEnd: 12,
  },

  resumeLabel: { color: '#9aa8bd', fontSize: 12 },

  resumeChannelName: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

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

  fullscreenButton: {
    position: 'absolute',
    right: 12,
    bottom: 108,
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

  controlsBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 32,
    zIndex: 30,
    elevation: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },

  controlButton: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },

  controlButtonPlay: {
    backgroundColor: 'rgba(255,30,39,0.85)',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  controlButtonDisabled: {
    opacity: 0.35,
  },

  controlButtonText: { color: '#fff', fontSize: 20 },

  videoMessageOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 20,
  },
  videoMessageText: {
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 10,
  },
  videoErrorIcon: {
    fontSize: 30,
    marginBottom: 8,
  },
  videoRetryButton: {
    marginTop: 16,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  videoRetryText: {
    color: '#111',
    fontSize: 14,
    fontWeight: '700',
  },
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
    bottom: 32,
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
    zIndex: 60,
  },

  miniPlayerCloseText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  clockBox: { alignItems: 'center', marginHorizontal: 10 },
  clockTime: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  clockDate: { color: '#b9c6da', fontSize: 10 },

  fsTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 35,
    elevation: 35,
  },

  fsTopButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 4,
  },

  fsTopButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  fsTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },

  lockBadge: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 40,
    elevation: 40,
  },

  lockBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  sideSlider: {
    position: 'absolute',
    top: '28%',
    height: '44%',
    alignItems: 'center',
    zIndex: 25,
  },

  sideIcon: { fontSize: 18, marginBottom: 8 },

  sliderTrack: {
    flex: 1,
    width: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },

  sliderFill: { width: 6, backgroundColor: '#fff', borderRadius: 3 },

  epgBar: { position: 'absolute', left: 18, right: 18, zIndex: 25 },

  epgNow: { color: '#fff', fontSize: 13, fontWeight: '700' },
  epgNext: { color: '#b9c6da', fontSize: 12, marginTop: 6 },

  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
    marginTop: 6,
  },

  progressFill: { height: 3, backgroundColor: '#ff1e27', borderRadius: 2 },

  drawerToggle: { backgroundColor: 'rgba(255,255,255,0.18)' },

  drawerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 45,
    elevation: 45,
  },

  channelDrawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 320,
    maxWidth: '85%',
    backgroundColor: 'rgba(11,18,32,0.97)',
    borderLeftWidth: 1,
    borderLeftColor: '#273247',
    paddingHorizontal: 10,
  },

  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#273247',
    marginBottom: 6,
  },

  drawerTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

  drawerCloseText: {
    color: '#fff',
    fontSize: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  drawerItem: {
    height: DRAWER_ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 2,
  },

  drawerItemActive: { backgroundColor: '#1f6f8b' },

  drawerNumber: {
    color: '#7f8da3',
    fontSize: 11,
    width: 52,
    textAlign: 'left',
  },

  drawerLogo: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: '#26344d',
    marginHorizontal: 8,
  },

  drawerName: { flex: 1, color: '#e6ecf5', fontSize: 14 },

  drawerTextActive: { color: '#fff', fontWeight: 'bold' },

  drawerPlaying: { color: '#ff1e27', fontSize: 13, paddingHorizontal: 6 },
});
