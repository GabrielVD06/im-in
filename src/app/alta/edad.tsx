import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { useProfile } from '@/state/profile-context';
import { useColors, type Palette } from '@/theme/colors';

export default function EdadScreen() {
  const { profile, save } = useProfile();
  const [checked, setChecked] = useState(profile.ageConfirmed);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  async function continueNext() {
    await save({ ageConfirmed: true });
    router.push('/alta/permisos');
  }

  return (
    <Screen
      step={1}
      total={5}
      title="I'm in es para mayores de 18 años."
      subtitle="Marca la casilla solo si ya los cumpliste."
      onBack={() => router.back()}
      footer={<Button label="Seguir" disabled={!checked} onPress={continueNext} />}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={() => setChecked((value) => !value)}
        style={styles.row}>
        <View style={[styles.box, checked ? styles.boxOn : null]}>
          {checked ? <Text style={styles.mark}>✓</Text> : null}
        </View>
        <Text style={styles.label}>Tengo 18 años o más.</Text>
      </Pressable>
    </Screen>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 56,
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.line,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    box: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    boxOn: {
      backgroundColor: colors.action,
      borderColor: colors.action,
    },
    mark: {
      color: colors.onAction,
      fontSize: 14,
      fontWeight: '500',
    },
    label: {
      flex: 1,
      color: colors.ink,
      fontSize: 16,
    },
  });
}
