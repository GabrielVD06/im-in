import { Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabGlyph } from '@/components/tab-icon';
import { useColors, useScheme } from '@/theme/colors';
import { HideTabsProvider } from '@/ui/hide-tabs';

export const unstable_settings = {
  initialRouteName: 'entreno',
};

export default function AppTabs() {
  const colors = useColors();
  const scheme = useScheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tablet = width >= 840;
  const side = tablet ? Math.max(24, (width - 520) / 2) : width < 390 ? 8 : 12;

  const barStyle = {
    backgroundColor: colors.card,
    borderTopWidth: 0,
    marginHorizontal: side,
    marginBottom: Math.max(insets.bottom, 8),
    height: 62,
    borderRadius: 31,
    paddingTop: 4,
    paddingBottom: 6,
    elevation: 8,
    shadowColor: '#000000',
    shadowOpacity: scheme === 'dark' ? 0.45 : 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  };

  return (
    <HideTabsProvider>
      {(tabsHidden) => (
    <Tabs
      backBehavior="initialRoute"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.paper },
        tabBarActiveTintColor: colors.action,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: tabsHidden ? { display: 'none' } : barStyle,
        tabBarLabelStyle: {
          fontSize: width < 390 ? 10 : 11,
          fontWeight: '600',
        },
        tabBarItemStyle: {
          paddingTop: 2,
        },
      }}>
      <Tabs.Screen
        name="salidas"
        options={{
          title: 'Salidas',
          tabBarIcon: ({ color }) => <TabGlyph name="salidas" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="gente"
        options={{
          title: 'Match',
          tabBarIcon: ({ color }) => <TabGlyph name="gente" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="entreno"
        options={{
          title: 'Entreno',
          tabBarIcon: () => <TabGlyph name="entreno" color={colors.onAction} fill={colors.action} />,
        }}
      />
      <Tabs.Screen
        name="mensajes"
        options={{
          title: 'Mensajes',
          tabBarIcon: ({ color }) => <TabGlyph name="mensajes" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="tu"
        options={{
          title: 'Tú',
          tabBarIcon: ({ color }) => <TabGlyph name="tu" color={String(color)} />,
        }}
      />
      <Tabs.Screen name="proponer" options={{ href: null }} />
    </Tabs>
      )}
    </HideTabsProvider>
  );
}
