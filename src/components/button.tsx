import { type ReactNode, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { space, useColors, type Palette } from '@/theme/colors';

type ButtonProps = PressableProps & {
  label: string;
  variant?: 'primary' | 'quiet';
  size?: 'regular' | 'compact';
};

export function Button({ label, variant = 'primary', size = 'regular', disabled, style, ...props }: ButtonProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={(state) => [
        styles.base,
        size === 'compact' ? styles.compact : null,
        variant === 'primary' ? styles.primary : styles.quiet,
        variant === 'primary' && state.pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}>
      <Text style={[styles.label, size === 'compact' ? styles.compactLabel : null, variant === 'quiet' ? styles.quietLabel : null]}>{label}</Text>
    </Pressable>
  );
}

type ChoiceProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  detail?: string;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Choice({ label, selected, onPress, detail, icon, style }: ChoiceProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, selected ? styles.choiceSelected : null, style]}>
      {icon}
      <View style={styles.choiceText}>
        <Text style={styles.choiceLabel}>{label}</Text>
        {detail ? <Text style={styles.choiceDetail}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

type PillProps = {
  label: string;
  selected?: boolean;
  tone?: 'quiet' | 'soft' | 'solid';
  onPress: () => void;
};

export function Pill({ label, selected = false, tone = 'quiet', onPress }: PillProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const look = tone === 'solid' ? styles.pillSolid : selected || tone === 'soft' ? styles.pillSoft : styles.pillQuiet;
  const text = tone === 'solid' ? styles.pillSolidLabel : selected || tone === 'soft' ? styles.pillSoftLabel : styles.pillQuietLabel;

  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.pill, look]}>
      <Text style={text}>{label}</Text>
    </Pressable>
  );
}

type SegmentProps = {
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
};

export function Segment({ value, options, onChange }: SegmentProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.segment}>
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.id)}
            style={[styles.segmentItem, selected ? styles.segmentOn : null]}>
            <Text style={[styles.segmentLabel, selected ? styles.segmentLabelOn : null]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Card({ children }: { children: ReactNode }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.card}>{children}</View>;
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    base: {
      minHeight: 52,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: space.lg,
    },
    compact: {
      minHeight: 40,
      paddingHorizontal: space.md,
    },
    pill: {
      height: 40,
      alignSelf: 'flex-start',
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pillQuiet: {
      backgroundColor: colors.card,
      borderColor: colors.line,
    },
    pillSoft: {
      backgroundColor: colors.actionSoft,
      borderColor: colors.action,
    },
    pillSolid: {
      backgroundColor: colors.action,
      borderColor: colors.action,
    },
    pillQuietLabel: {
      color: colors.ink,
      fontSize: 14,
      fontWeight: '500',
    },
    pillSoftLabel: {
      color: colors.action,
      fontSize: 14,
      fontWeight: '500',
    },
    pillSolidLabel: {
      color: colors.onAction,
      fontSize: 14,
      fontWeight: '500',
    },
    segment: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.line,
      padding: 4,
      gap: 4,
    },
    segmentItem: {
      flex: 1,
      minHeight: 40,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentOn: {
      backgroundColor: colors.action,
    },
    segmentLabel: {
      color: colors.ink,
      fontSize: 15,
      fontWeight: '500',
    },
    segmentLabelOn: {
      color: colors.onAction,
    },
    primary: {
      backgroundColor: colors.action,
    },
    quiet: {
      backgroundColor: 'transparent',
    },
    pressed: {
      backgroundColor: colors.actionPressed,
    },
    disabled: {
      opacity: 0.4,
    },
    label: {
      color: colors.onAction,
      fontSize: 16,
      fontWeight: '500',
    },
    compactLabel: {
      fontSize: 14,
    },
    quietLabel: {
      color: colors.ink,
    },
    choice: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.card,
      paddingHorizontal: space.md,
      paddingVertical: 14,
      gap: 12,
    },
    choiceText: {
      flex: 1,
      gap: 4,
    },
    choiceSelected: {
      borderColor: colors.action,
      backgroundColor: colors.actionSoft,
    },
    choiceLabel: {
      color: colors.ink,
      fontSize: 16,
      fontWeight: '500',
    },
    choiceDetail: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.line,
      padding: space.md,
      gap: space.sm,
    },
  });
}
