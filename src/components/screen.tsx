import { type ReactNode, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { space, useColors, type Palette } from '@/theme/colors';
import { useFrame } from '@/ui/use-frame';

type ScreenProps = {
  title: string;
  subtitle?: string;
  step?: number;
  total?: number;
  children?: ReactNode;
  footer?: ReactNode;
  onBack?: () => void;
  headerAction?: ReactNode;
  footerMode?: 'dock' | 'flow';
};

export function Screen({ title, subtitle, step, total, children, footer, onBack, headerAction, footerMode = 'dock' }: ScreenProps) {
  const colors = useColors();
  const frame = useFrame();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, frame.gutter, Math.max(insets.bottom, 12)), [colors, frame.gutter, insets.bottom]);
  const flowing = footerMode === 'flow';

  return (
    <View style={styles.frame}>
      <SafeAreaView style={[styles.safe, frame.wide ? styles.safeWide : null]} edges={['top', 'left', 'right']}>
        <View style={styles.top}>
          {onBack ? (
            <Text accessibilityRole="button" onPress={onBack} style={styles.back}>
              Atrás
            </Text>
          ) : (
            <View style={styles.backSpacer} />
          )}
          {headerAction ?? (step && total ? <Progress step={step} total={total} styles={styles} /> : <View style={styles.backSpacer} />)}
        </View>
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.scroll}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {children ? <View style={styles.body}>{children}</View> : null}
          {flowing && footer ? <View style={styles.flowFooter}>{footer}</View> : null}
        </ScrollView>
        {!flowing && footer ? <View style={styles.footer}>{footer}</View> : null}
      </SafeAreaView>
    </View>
  );
}

function Progress({
  step,
  total,
  styles,
}: {
  step: number;
  total: number;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View accessibilityLabel={`Paso ${step} de ${total}`} style={styles.progress}>
      {Array.from({ length: total }, (_, index) => (
        <View key={index} style={[styles.dot, index < step ? styles.dotOn : null]} />
      ))}
    </View>
  );
}

function createStyles(colors: Palette, gutter: number, bottom: number) {
  return StyleSheet.create({
    frame: {
      flex: 1,
      backgroundColor: colors.paper,
      alignItems: 'center',
    },
    safe: {
      flex: 1,
      width: '100%',
      backgroundColor: colors.paper,
    },
    safeWide: {
      maxWidth: 640,
    },
    top: {
      minHeight: 52,
      paddingHorizontal: gutter,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    back: {
      color: colors.ink,
      fontSize: 15,
      fontWeight: '600',
      minHeight: 44,
      textAlignVertical: 'center',
      paddingVertical: 10,
    },
    backSpacer: {
      width: 48,
    },
    progress: {
      flexDirection: 'row',
      gap: 6,
    },
    dot: {
      width: 18,
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.line,
    },
    dotOn: {
      backgroundColor: colors.action,
    },
    scroll: {
      paddingHorizontal: gutter,
      paddingBottom: space.lg,
      gap: 10,
    },
    title: {
      color: colors.ink,
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '700',
      marginTop: space.xs,
    },
    subtitle: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 21,
    },
    body: {
      marginTop: space.md,
      gap: space.sm,
    },
    flowFooter: {
      marginTop: space.md,
      paddingBottom: bottom,
    },
    footer: {
      paddingHorizontal: gutter,
      paddingTop: 8,
      paddingBottom: bottom,
      gap: space.xs,
    },
  });
}
