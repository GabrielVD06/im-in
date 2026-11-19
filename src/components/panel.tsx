import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { space, useColors, type Palette } from '@/theme/colors';

type InfoCardProps = {
  kicker: string;
  title: string;
  body: string;
};

export function InfoCard({ kicker, title, body }: InfoCardProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <Text style={styles.section}>{children}</Text>;
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.line,
      padding: space.md,
      gap: 6,
    },
    kicker: {
      color: colors.action,
      fontSize: 13,
      fontWeight: '500',
    },
    title: {
      color: colors.ink,
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '500',
    },
    body: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 21,
    },
    section: {
      color: colors.ink,
      fontSize: 14,
      fontWeight: '500',
      marginTop: space.sm,
    },
  });
}
