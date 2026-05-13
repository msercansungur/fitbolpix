import React, { useState, useEffect, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BarlowCondensed_700Bold,
  BarlowCondensed_600SemiBold,
} from '@expo-google-fonts/barlow-condensed';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import RootNavigator from './src/navigation/RootNavigator';
import SplashScreen from './src/screens/SplashScreen';
import OnboardingModal from './src/components/OnboardingModal';

const ONBOARDING_KEY = 'onboardingSeen';

export default function App() {
  const [fontsLoaded] = useFonts({
    BarlowCondensed_700Bold,
    BarlowCondensed_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    'Born2bSportyFS': require('./fonts/Born2bSportyFS.otf'),
  });

  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (!cancelled && !seen) setShowOnboarding(true);
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, []);

  const handleOnboardingDismiss = useCallback(async () => {
    setShowOnboarding(false);
    try { await AsyncStorage.setItem(ONBOARDING_KEY, 'true'); } catch (_) {}
  }, []);

  if (!fontsLoaded) {
    return <SplashScreen />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <RootNavigator />
      </NavigationContainer>
      <OnboardingModal visible={showOnboarding} onDismiss={handleOnboardingDismiss} />
    </SafeAreaProvider>
  );
}
