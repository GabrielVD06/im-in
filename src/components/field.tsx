import { useMemo } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { space, useColors, type Palette } from '@/theme/colors';

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'decimal-pad';
  autoCapitalize?: 'none' | 'words' | 'sentences';
  autoCorrect?: boolean;
  maxLength?: number;
  multiline?: boolean;
  error?: string;
};

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoCorrect,
  maxLength,
  multiline = false,
  error,
}: FieldProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect ?? keyboardType !== 'email-address'}
        maxLength={maxLength}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline ? styles.inputMulti : null, error ? styles.inputError : null]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    wrap: {
      gap: 6,
    },
    label: {
      color: colors.ink,
      fontSize: 14,
      fontWeight: '500',
    },
    input: {
      minHeight: 52,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.card,
      paddingHorizontal: space.md,
      color: colors.ink,
      fontSize: 16,
    },
    inputMulti: {
      minHeight: 96,
      paddingTop: 14,
      paddingBottom: 14,
    },
    inputError: {
      borderColor: colors.danger,
    },
    error: {
      color: colors.danger,
      fontSize: 14,
    },
  });
}
