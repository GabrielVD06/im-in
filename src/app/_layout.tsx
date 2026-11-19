import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';

import { FriendsProvider } from '@/state/friends-context';
import { MeetupProvider } from '@/state/meetup-context';
import { ProfileProvider, useProfile } from '@/state/profile-context';
import { SocialProvider } from '@/state/social-context';
import { loadThemeChoice, useColors, useScheme } from '@/theme/colors';
import { loadMapBearing, loadMapStyle } from '@/theme/map-style';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    Promise.all([loadThemeChoice(), loadMapStyle(), loadMapBearing()]).finally(() => setThemeReady(true));
  }, []);

  if (!themeReady) {
    return null;
  }

  return (
    <ProfileProvider>
      <MeetupProvider>
        <SocialProvider>
          <FriendsProvider>
            <RootNavigator />
          </FriendsProvider>
        </SocialProvider>
      </MeetupProvider>
    </ProfileProvider>
  );
}

function RootNavigator() {
  const { ready } = useProfile();
  const colors = useColors();
  const scheme = useScheme();

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.paper);
  }, [colors.paper]);

  if (!ready) {
    return null;
  }

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.paper },
          animation: 'slide_from_right',
        }}
      />
    </>
  );
}
