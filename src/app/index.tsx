import { Redirect } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useProfile } from '@/state/profile-context';
import { useColors, type Palette } from '@/theme/colors';

export default function Index() {
  const { ready, profile } = useProfile();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.action} />
      </View>
    );
  }

  if (profile.completedAt) {
    return <Redirect href="/entreno" />;
  }

  return <Redirect href="/alta/bienvenida" />;
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.paper,
    },
  });
}
