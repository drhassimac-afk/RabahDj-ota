import * as Sharing from 'expo-sharing';
import * as Notifications from 'expo-notifications';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, PermissionsAndroid, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import HtmlHost, { type HtmlHostHandle } from '@/components/html-host';
import { usePttRecorder } from '@/hooks/use-ptt-recorder';
import { RABAHDJ_HTML } from '../htmlContent';
import WalkieNative from '@/components/walkie-native';
import LiveNative from '@/components/live-native';
import FilesNative, { type NativeFileEntry } from '@/components/files-native';
import CinemaNative from '@/components/cinema-native';
import GamesNative, { type XoState, type ChessState } from '@/components/games-native';
import ChatNative, { type ChatMessage } from '@/components/chat-native';
import NearbyNative from '@/components/nearby-native';
import SettingsNative, { type SettingsState } from '@/components/settings-native';
import ProfileNative, { type ProfileState } from '@/components/profile-native';
import HomeNative from '@/components/home-native';
import AdminLoginModal from '@/components/admin-login-modal';
import AdminChangePasswordModal from '@/components/admin-change-password-modal';
import AdminBroadcastModal from '@/components/admin-broadcast-modal';
import AdminNative, { type AdminStats } from '@/components/admin-native';
import { checkAdminLogin, changeAdminCredentials } from '@/lib/admin-auth';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://bcc2e8f4dbd04961dd25daade30bfeb3@o4512108571066368.ingest.de.sentry.io/4512108585484368',
  debug: false,
  tracesSampleRate: 1.0,
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'video/mp4': 'mp4',
  'audio/mpeg': 'mp3',
};

async function handleFileDownload(downloadUrl: string) {
  try {
    const match = downloadUrl.match(/^data:([^;]+);base64,(.*)$/s);
    if (!match) {
      Alert.alert('تعذر التحميل', 'صيغة الملف غير مدعومة');
      return;
    }
    const mime = match[1];
    const base64 = match[2];
    const ext = MIME_EXT[mime] || (mime.split('/')[1] || 'bin').replace(/[^a-zA-Z0-9]/g, '');
    const filename = `rabahdj_${Date.now()}.${ext}`;
    const fileUri = FileSystem.cacheDirectory + filename;
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, { mimeType: mime, dialogTitle: 'حفظ أو فتح الملف' });
    } else {
      Alert.alert('تم الحفظ', 'الملف محفوظ في: ' + fileUri);
    }
  } catch (error: unknown) {
    Alert.alert('خطأ بالتحميل', error instanceof Error ? error.message : String(error));
  }
}

async function readAudioAsBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('تعذر قراءة الملف الصوتي'));
      reader.onload = () => {
        const result = String(reader.result ?? '');
        resolve(result.slice(result.indexOf(',') + 1));
      };
      reader.readAsDataURL(blob);
    });
  }
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

async function setupNotifications() {
  try {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync('rabahdj', {
      name: 'RabahDj',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    const permissions = await Notifications.getPermissionsAsync();
    if (permissions.status !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }
  } catch (error) {
    console.log('notification setup error', error);
  }
}

async function showRabahNotification(title: string, body: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
      },
      trigger: null,
    });
  } catch (error) {
    console.log('notification error', error);
  }
}

const MAX_FILE_BYTES = 8 * 1024 * 1024;

type CinemaCategory = 'movies' | 'tv' | 'series';
type GameTab = 'xo' | 'chess';

function Index() {
  const [ready, setReady] = useState(false);
  const [showWalkie, setShowWalkie] = useState(false);
  const [isPttRecording, setIsPttRecording] = useState(false);
  const [lastSpeaker, setLastSpeaker] = useState<string | null>(null);

  const [showLive, setShowLive] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);

  const [showFiles, setShowFiles] = useState(false);
  const [nativeFiles, setNativeFiles] = useState<NativeFileEntry[]>([]);

  const [showCinema, setShowCinema] = useState(false);
  const [cinemaCategory, setCinemaCategory] = useState<CinemaCategory>('movies');
  const [cinemaHistory, setCinemaHistory] = useState<string[]>([]);

  const [showGames, setShowGames] = useState(false);
  const [activeGameTab, setActiveGameTab] = useState<GameTab>('xo');
  const [xoState, setXoState] = useState<XoState | null>(null);
  const [chessState, setChessState] = useState<ChessState | null>(null);

  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const [showNearby, setShowNearby] = useState(false);
  const [nearbyNames, setNearbyNames] = useState<string[]>([]);
  const [nearbyMyName, setNearbyMyName] = useState('');

  const [showSettings, setShowSettings] = useState(false);
  const [settingsState, setSettingsState] = useState<SettingsState | null>(null);

  const [showProfile, setShowProfile] = useState(false);
  const [profileState, setProfileState] = useState<ProfileState | null>(null);

  const [homeName, setHomeName] = useState('');
  const [homeRoom, setHomeRoom] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('غير متصل');
  const homeNamePrefilledRef = useRef(false);
  const hostRef = useRef<HtmlHostHandle>(null);

  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);

  const injectToPage = useCallback((code: string) => {
    hostRef.current?.injectJavaScript(code);
  }, []);

  const handleRecorded = useCallback(
    async (uri: string) => {
      const base64 = await readAudioAsBase64(uri);
      injectToPage(
        `window.onNativePttRecorded && window.onNativePttRecorded(${JSON.stringify(base64)});`
      );
    },
    [injectToPage]
  );

  const handleRecorderError = useCallback(
    (message: string) => {
      injectToPage(
        `window.onNativePttError && window.onNativePttError(${JSON.stringify(message)});`
      );
    },
    [injectToPage]
  );

  const { start: startPtt, stop: stopPtt } = usePttRecorder({
    onRecorded: handleRecorded,
    onError: handleRecorderError,
  });

  const handleWalkiePressIn = useCallback(() => {
    setIsPttRecording(true);
    void startPtt();
  }, [startPtt]);

  const handleWalkiePressOut = useCallback(() => {
    setIsPttRecording(false);
    void stopPtt();
  }, [stopPtt]);

  const openLive = useCallback(() => {
    setShowLive(true);
    injectToPage(`go('live'); void 0;`);
  }, [injectToPage]);

  const closeLive = useCallback(() => {
    injectToPage(`stopLive(); go('home'); void 0;`);
    setShowLive(false);
    setIsLive(false);
    setIsMicMuted(false);
  }, [injectToPage]);

  const handleToggleLive = useCallback(() => {
    injectToPage(`toggleLive(); void 0;`);
  }, [injectToPage]);

  const handleToggleMic = useCallback(() => {
    injectToPage(`toggleMic(); void 0;`);
  }, [injectToPage]);

  const handleSwitchCamera = useCallback(() => {
    injectToPage(`switchCamera(); void 0;`);
  }, [injectToPage]);

  const handlePickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      for (const asset of result.assets) {
        if (asset.size && asset.size > MAX_FILE_BYTES) {
          Alert.alert('ملف كبير جدًا', `تم تجاهل ${asset.name} (أكبر من 8MB)`);
          continue;
        }
        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const mime = asset.mimeType || 'application/octet-stream';
        const dataUrl = `data:${mime};base64,${base64}`;
        injectToPage(
          `window.onNativeFilePicked && window.onNativeFilePicked(${JSON.stringify(asset.name)}, ${asset.size ?? 0}, ${JSON.stringify(dataUrl)});`
        );
      }
    } catch (error) {
      Alert.alert('خطأ', error instanceof Error ? error.message : String(error));
    }
  }, [injectToPage]);

  const handleDownloadFile = useCallback((file: NativeFileEntry) => {
    void handleFileDownload(file.dataUrl);
  }, []);

  const openCinema = useCallback(() => {
    setShowCinema(true);
    injectToPage(`go('cinema'); showCinemaTab('movies'); void 0;`);
  }, [injectToPage]);

  const closeCinema = useCallback(() => {
    injectToPage(`go('home'); void 0;`);
    setShowCinema(false);
  }, [injectToPage]);

  const handleSelectCinemaCategory = useCallback(
    (cat: CinemaCategory) => {
      injectToPage(`showCinemaTab(${JSON.stringify(cat)}); void 0;`);
    },
    [injectToPage]
  );

  const handleCinemaPlay = useCallback(
    (url: string) => {
      injectToPage(`playCinema(true, ${JSON.stringify(url)}); void 0;`);
    },
    [injectToPage]
  );

  const openGames = useCallback(() => {
    setShowGames(true);
    injectToPage(`go('games'); showGame('xo'); void 0;`);
  }, [injectToPage]);

  const closeGames = useCallback(() => {
    injectToPage(`go('home'); void 0;`);
    setShowGames(false);
  }, [injectToPage]);

  const handleSelectGameTab = useCallback(
    (tab: GameTab) => {
      injectToPage(`showGame(${JSON.stringify(tab)}); void 0;`);
    },
    [injectToPage]
  );

  const handleXoCell = useCallback(
    (index: number) => {
      injectToPage(`clickXO(${index}); void 0;`);
    },
    [injectToPage]
  );

  const handleChessCell = useCallback(
    (row: number, col: number) => {
      injectToPage(`clickChessSq(${row}, ${col}); void 0;`);
    },
    [injectToPage]
  );

  const handleResetXo = useCallback(() => {
    injectToPage(`resetXO(); void 0;`);
  }, [injectToPage]);

  const handleResetChess = useCallback(() => {
    injectToPage(`resetChess(); void 0;`);
  }, [injectToPage]);

  const openChat = useCallback(() => {
    setShowChat(true);
    injectToPage(`go('chat'); void 0;`);
  }, [injectToPage]);

  const closeChat = useCallback(() => {
    injectToPage(`go('home'); void 0;`);
    setShowChat(false);
  }, [injectToPage]);

  const handleSendChat = useCallback(
    (text: string) => {
      injectToPage(`$('#txt').value=${JSON.stringify(text)}; sendChat(); void 0;`);
    },
    [injectToPage]
  );

  const openNearby = useCallback(() => {
    setShowNearby(true);
    injectToPage(`go('nearby'); renderNearby(); void 0;`);
  }, [injectToPage]);

  const closeNearby = useCallback(() => {
    injectToPage(`go('home'); void 0;`);
    setShowNearby(false);
  }, [injectToPage]);

  const handleWave = useCallback(
    (name: string) => {
      injectToPage(`waveTo(${JSON.stringify(name)}); void 0;`);
    },
    [injectToPage]
  );

  const openSettings = useCallback(() => {
    setShowSettings(true);
    injectToPage(`go('settings'); loadSettings(); void 0;`);
  }, [injectToPage]);

  const closeSettings = useCallback(() => {
    injectToPage(`go('home'); void 0;`);
    setShowSettings(false);
  }, [injectToPage]);

  const handleSaveSettingsName = useCallback(
    (name: string) => {
      injectToPage(`$('#settingsName').value=${JSON.stringify(name)}; saveName(); void 0;`);
    },
    [injectToPage]
  );

  const handleToggleSettingOption = useCallback(
    (key: 'notif' | 'vibrate' | 'sound', value: boolean) => {
      const idMap: Record<string, string> = { notif: 'optNotif', vibrate: 'optVibrate', sound: 'optSound' };
      injectToPage(`document.getElementById('${idMap[key]}').checked=${value}; saveOptions(); void 0;`);
    },
    [injectToPage]
  );

  const handleSaveConnection = useCallback(
    (enabled: boolean, ip: string, port: string) => {
      injectToPage(
        `document.getElementById('optLocalServer').checked=${enabled}; $('#localServerIp').value=${JSON.stringify(ip)}; $('#localServerPort').value=${JSON.stringify(port)}; saveConnectionMode(); void 0;`
      );
    },
    [injectToPage]
  );

  const handleClearSettingsData = useCallback(() => {
    injectToPage(`clearSavedData(); void 0;`);
  }, [injectToPage]);

  const openProfile = useCallback(() => {
    setShowProfile(true);
    injectToPage(`go('profile'); loadProfile(); void 0;`);
  }, [injectToPage]);

  const closeProfile = useCallback(() => {
    injectToPage(`go('home'); void 0;`);
    setShowProfile(false);
  }, [injectToPage]);

  const handleSaveProfile = useCallback(
    (name: string, status: string) => {
      injectToPage(
        `$('#profileName').value=${JSON.stringify(name)}; $('#profileStatus').value=${JSON.stringify(status)}; saveProfile(); void 0;`
      );
    },
    [injectToPage]
  );

  const handleConnectRoom = useCallback(() => {
    injectToPage(
      `$('#name').value=${JSON.stringify(homeName)}; $('#room').value=${JSON.stringify(homeRoom)}; join(); void 0;`
    );
  }, [injectToPage, homeName, homeRoom]);

  const requestAdminStats = useCallback(() => {
    injectToPage(`window.getAdminStats && window.getAdminStats(); void 0;`);
  }, [injectToPage]);

  const handleAdminLoginSubmit = useCallback(
    async (user: string, pass: string) => {
      const ok = await checkAdminLogin(user, pass);
      if (ok) {
        setAdminLoginError(null);
        setShowAdminLogin(false);
        setShowAdmin(true);
        requestAdminStats();
      } else {
        setAdminLoginError('اسم المستخدم أو كلمة السر غير صحيحة');
      }
    },
    [requestAdminStats]
  );

  const handleKickMember = useCallback(
    (peerId: string) => {
      injectToPage(`window.adminKickMember && window.adminKickMember(${JSON.stringify(peerId)}); void 0;`);
      setTimeout(requestAdminStats, 400);
    },
    [injectToPage, requestAdminStats]
  );

  const handleBanMember = useCallback(
    (userId: string, peerId: string) => {
      if (!userId) {
        Alert.alert('تعذر الحظر', 'هذا العضو لا يملك userId صالحًا.');
        return;
      }

      Alert.alert(
        'حظر العضو',
        'سيتم حظر هذا المستخدم من الغرفة الحالية بشكل دائم على هذا الجهاز. هل تريد المتابعة؟',
        [
          { text: 'إلغاء', style: 'cancel' },
          {
            text: 'حظر',
            style: 'destructive',
            onPress: () => {
              injectToPage(
                `window.adminBanMember && window.adminBanMember(${JSON.stringify(userId)}, ${JSON.stringify(peerId)}); void 0;`
              );
              setTimeout(requestAdminStats, 400);
            },
          },
        ]
      );
    },
    [injectToPage, requestAdminStats]
  );

  const handleBroadcastSubmit = useCallback(
    (text: string) => {
      injectToPage(`window.adminBroadcastAnnouncement && window.adminBroadcastAnnouncement(${JSON.stringify(text)}); void 0;`);
    },
    [injectToPage]
  );

  const handleChangePasswordSubmit = useCallback(
    async (oldPass: string, newUser: string, newPass: string) => {
      const result = await changeAdminCredentials(oldPass, newUser, newPass);
      if (result.ok) {
        setChangePasswordError(null);
        setShowChangePassword(false);
        Alert.alert('تم', 'تم تحديث بيانات دخول المسؤول بنجاح');
      } else {
        setChangePasswordError(result.error ?? 'حدث خطأ');
      }
    },
    []
  );

  useEffect(() => {
    async function requestPerms() {
      if (Platform.OS === 'android') {
        try {
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.CAMERA,
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          ]);

          const { status } = await Notifications.requestPermissionsAsync();
          if (status !== 'granted') {
            console.log('Notification permission not granted');
          }

          await Notifications.setNotificationChannelAsync('default', {
            name: 'RabahDj',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            sound: 'default',
          });
        } catch (error) {
          console.log('permission error', error);
        }
      }

      setReady(true);
    }

    requestPerms();
  }, []);

  const showNativeNotification = useCallback(
    (title: string, body: string) => {
      void Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'default',
        },
        trigger: null,
      });
    },
    []
  );

  const handleMessage = useCallback(
    (data: string) => {
      try {
        const msg = JSON.parse(data) as {
          cmd?: string;
          title?: string;
          body?: string;
          name?: string;
          mine?: boolean;
          active?: boolean;
          muted?: boolean;
          size?: number;
          dataUrl?: string;
          from?: string;
          category?: CinemaCategory;
          history?: string[];
          board?: unknown;
          turn?: string | null;
          score?: { X: number; O: number };
          winLine?: number[] | null;
          mySymbol?: string;
          selected?: [number, number] | null;
          captured?: { w: string[]; b: string[] };
          myColor?: string;
          validMoves?: [number, number][];
          which?: GameTab;
          text?: string;
          names?: string[];
          myName?: string;
          notif?: boolean;
          vibrate?: boolean;
          sound?: boolean;
          localEnabled?: boolean;
          localIp?: string;
          localPort?: string;
          lastRoom?: string;
          status?: string;
          avatar?: string;
          msgs?: number;
          notifs?: number;
          connected?: number;
          viewers?: number;
          room?: string;
          isHost?: boolean;
          members?: { peerId: string; name: string }[];
        };

        if (msg.cmd === 'pttStart') void startPtt();
        if (msg.cmd === 'pttStop') void stopPtt();

        if (msg.cmd === 'walkieLastSpeaker' && msg.name) {
          setLastSpeaker(msg.mine ? 'أنت' : msg.name);
        }

        if (msg.cmd === 'liveStatus' && typeof msg.active === 'boolean') {
          setIsLive(msg.active);
        }

        if (msg.cmd === 'micStatus' && typeof msg.muted === 'boolean') {
          setIsMicMuted(msg.muted);
        }

        if (msg.cmd === 'fileReceived' && msg.name && msg.dataUrl) {
          const entry: NativeFileEntry = {
            id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
            name: msg.name,
            size: msg.size ?? 0,
            dataUrl: msg.dataUrl,
            from: msg.from ?? '?',
            mine: !!msg.mine,
          };
          setNativeFiles((prev) => [entry, ...prev]);
        }

        if (msg.cmd === 'cinemaState' && msg.category) {
          setCinemaCategory(msg.category);
          setCinemaHistory(msg.history ?? []);
        }

        if (msg.cmd === 'xoState' && msg.board && msg.score && msg.mySymbol) {
          setXoState({
            board: msg.board as string[],
            turn: msg.turn ?? null,
            score: msg.score,
            winLine: msg.winLine ?? null,
            mySymbol: msg.mySymbol,
          });
        }

        if (msg.cmd === 'chessState' && msg.board && msg.turn && msg.myColor && msg.captured) {
          setChessState({
            board: msg.board as string[][],
            turn: msg.turn,
            selected: msg.selected ?? null,
            captured: msg.captured,
            myColor: msg.myColor,
            validMoves: msg.validMoves ?? [],
          });
        }

        if (msg.cmd === 'gameTab' && msg.which) {
          setActiveGameTab(msg.which);
        }

        if (msg.cmd === 'chatMessage' && msg.name && typeof msg.text === 'string') {
          const entry: ChatMessage = {
            id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
            name: msg.name,
            text: msg.text,
            mine: !!msg.mine,
          };
          setChatMessages((prev) => [...prev, entry]);
        }

        if (msg.cmd === 'nearbyState') {
          setNearbyNames(msg.names ?? []);
          setNearbyMyName(msg.myName ?? '');
        }

        if (msg.cmd === 'settingsState') {
          setSettingsState({
            name: msg.name ?? '',
            notif: msg.notif ?? true,
            vibrate: msg.vibrate ?? true,
            sound: msg.sound ?? true,
            localEnabled: msg.localEnabled ?? false,
            localIp: msg.localIp ?? '',
            localPort: msg.localPort ?? '9000',
            lastRoom: msg.lastRoom ?? '',
          });
          if (!homeNamePrefilledRef.current && msg.name) {
            homeNamePrefilledRef.current = true;
            setHomeName(msg.name);
          }
        }

        if (msg.cmd === 'profileState') {
          setProfileState({
            name: msg.name ?? '',
            status: msg.status ?? '',
            avatar: msg.avatar ?? '',
          });
        }

        if (msg.cmd === 'connectionStatus' && typeof msg.text === 'string') {
          setConnectionStatus(msg.text);
        }

        if (msg.cmd === 'nativeNotification' && msg.title && msg.body) {
          void Notifications.scheduleNotificationAsync({
            content: {
              title: msg.title,
              body: msg.body,
              sound: 'default',
            },
            trigger: null,
          });
        }

        if (msg.cmd === 'adminStats') {
          setAdminStats({
            connected: msg.connected ?? 0,
            viewers: msg.viewers ?? 0,
            msgs: msg.msgs ?? 0,
            notifs: msg.notifs ?? 0,
            room: msg.room ?? '',
            isHost: !!msg.isHost,
            members: (msg.members ?? []).map((m: any) => ({
        peerId: m.peerId ?? '',
        userId: m.userId ?? '',
        name: m.name ?? '?',
      })),
          });
        }

        if (msg.cmd === 'kickedFromRoom') {
          Alert.alert('تم الفصل', 'تم فصلك من الغرفة من قبل الإدارة.');
        }
      } catch (error) {
        console.log('onMessage parse error', error);
      }
    },
    [startPtt, stopPtt]
  );

  if (!ready) return <SafeAreaView style={styles.container} />;

  const webviewNeedsVisible = showLive || showCinema;
  const isAnyOverlayActive =
    showWalkie || showLive || showFiles || showCinema || showGames || showChat || showNearby || showSettings || showProfile || showAdmin;

  const homeCards = [
    { key: 'live', label: 'بث مباشر', emoji: '📡', gradient: ['#7c1fd9', '#4a0f8c'] as [string, string], onPress: openLive },
    { key: 'cinema', label: 'سينما وتلفاز', emoji: '🎬', gradient: ['#00c853', '#009624'] as [string, string], onPress: openCinema },
    { key: 'walkie', label: 'تخاطب لاسلكي', emoji: '🎙️', gradient: ['#00c853', '#009624'] as [string, string], onPress: () => setShowWalkie(true) },
    { key: 'games', label: 'الألعاب', emoji: '🎮', gradient: ['#ff9800', '#e65100'] as [string, string], onPress: openGames },
    { key: 'chat', label: 'محادثات فورية', emoji: '💬', gradient: ['#448aff', '#1565c0'] as [string, string], onPress: openChat },
    { key: 'files', label: 'مشاركة ملفات', emoji: '📁', gradient: ['#7c1fd9', '#4a0f8c'] as [string, string], onPress: () => setShowFiles(true) },
    { key: 'nearby', label: 'قريبون مني', emoji: '📍', gradient: ['#ff9800', '#e65100'] as [string, string], onPress: openNearby },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <HtmlHost
        ref={hostRef}
        html={RABAHDJ_HTML}
        onMessage={handleMessage}
        onFileDownload={handleFileDownload}
        style={webviewNeedsVisible ? styles.flexFull : styles.hidden}
      />

      {!isAnyOverlayActive && (
        <View style={styles.overlayFill}>
          <HomeNative
            cards={homeCards}
            name={homeName}
            room={homeRoom}
            connectionStatus={connectionStatus}
            onNameChange={setHomeName}
            onRoomChange={setHomeRoom}
            onConnect={handleConnectRoom}
            onOpenSettings={openSettings}
            onOpenProfile={openProfile}
          />
          <TouchableOpacity style={styles.adminLinkBtn} onPress={() => setShowAdminLogin(true)}>
            <Text style={styles.adminLinkText}>الدخول المسؤول</Text>
          </TouchableOpacity>
        </View>
      )}

      {showWalkie && (
        <View style={styles.overlayFill}>
          <WalkieNative
            isRecording={isPttRecording}
            lastSpeaker={lastSpeaker}
            onPressIn={handleWalkiePressIn}
            onPressOut={handleWalkiePressOut}
            onBack={() => setShowWalkie(false)}
          />
        </View>
      )}

      {showLive && (
        <LiveNative
          isLive={isLive}
          isMicMuted={isMicMuted}
          onToggleLive={handleToggleLive}
          onToggleMic={handleToggleMic}
          onSwitchCamera={handleSwitchCamera}
          onBack={closeLive}
        />
      )}

      {showFiles && (
        <View style={styles.overlayFill}>
          <FilesNative
            files={nativeFiles}
            onPickFile={handlePickFile}
            onDownload={handleDownloadFile}
            onBack={() => setShowFiles(false)}
          />
        </View>
      )}

      {showCinema && (
        <View style={styles.overlayFill}>
          <CinemaNative
            category={cinemaCategory}
            history={cinemaHistory}
            onSelectCategory={handleSelectCinemaCategory}
            onPlay={handleCinemaPlay}
            onBack={closeCinema}
          />
        </View>
      )}

      {showGames && (
        <View style={styles.overlayFill}>
          <GamesNative
            activeTab={activeGameTab}
            xo={xoState}
            chess={chessState}
            onSelectTab={handleSelectGameTab}
            onXoCell={handleXoCell}
            onChessCell={handleChessCell}
            onResetXo={handleResetXo}
            onResetChess={handleResetChess}
            onBack={closeGames}
          />
        </View>
      )}

      {showChat && (
        <View style={styles.overlayFill}>
          <ChatNative messages={chatMessages} onSend={handleSendChat} onBack={closeChat} />
        </View>
      )}

      {showNearby && (
        <View style={styles.overlayFill}>
          <NearbyNative names={nearbyNames} myName={nearbyMyName} onWave={handleWave} onBack={closeNearby} />
        </View>
      )}

      {showSettings && (
        <View style={styles.overlayFill}>
          <SettingsNative
            settings={settingsState}
            onSaveName={handleSaveSettingsName}
            onToggleOption={handleToggleSettingOption}
            onSaveConnection={handleSaveConnection}
            onClearData={handleClearSettingsData}
            onBack={closeSettings}
          />
        </View>
      )}

      {showProfile && (
        <View style={styles.overlayFill}>
          <ProfileNative profile={profileState} onSave={handleSaveProfile} onBack={closeProfile} />
        </View>
      )}

      {showAdmin && (
        <AdminNative
          stats={adminStats}
          onRefresh={requestAdminStats}
          onKick={handleKickMember}
          onBan={handleBanMember}
          onOpenChangePassword={() => setShowChangePassword(true)}
          onOpenBroadcast={() => setShowBroadcast(true)}
          onLogout={() => setShowAdmin(false)}
        />
      )}

      <AdminLoginModal
        visible={showAdminLogin}
        onClose={() => setShowAdminLogin(false)}
        onSubmit={handleAdminLoginSubmit}
        error={adminLoginError}
      />

      <AdminBroadcastModal
        visible={showBroadcast}
        onClose={() => setShowBroadcast(false)}
        onSubmit={handleBroadcastSubmit}
      />

      <AdminChangePasswordModal
        visible={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        onSubmit={handleChangePasswordSubmit}
        error={changePasswordError}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220' },
  flexFull: { flex: 1 },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  overlayFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0b1220' },
  adminLinkBtn: { position: 'absolute', bottom: 24, alignSelf: 'center', padding: 8 },
  adminLinkText: { color: '#8892b0', fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
});

export default Sentry.wrap(Index);
