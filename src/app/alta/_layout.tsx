import { Stack } from 'expo-router';

import { useColors } from '@/theme/colors';

export default function AltaLayout() {
  const colors = useColors();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.paper },
        animation: 'slide_from_right',
      }}
    />
  );
}
