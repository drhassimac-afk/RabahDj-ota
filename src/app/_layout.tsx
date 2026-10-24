import 'react-native-gesture-handler';
import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import GuardGate from '@/components/guard-gate';

// [ota-immediate] فحص وتفعيل فوري لأي تحديث JS عند كل إطلاق (production فقط)
import * as Updates from 'expo-updates';
void (async () => {
  try {
    if (__DEV__) return;
    const check = await Updates.checkForUpdateAsync();
    if (check.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch (e) {
    console.warn('OTA check failed:', e);
  }
})();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0b1220' }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <GuardGate>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#0b1220' },
            }}
          />
        </GuardGate>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
