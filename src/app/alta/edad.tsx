import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ageBand, birthDateKey, parseBirthDate } from '@/domain/profile';
import { useProfile } from '@/state/profile-context';
import { useColors, type Palette } from '@/theme/colors';

function yearsAgo(years: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return date;
}

export default function EdadScreen() {
  const { profile, save } = useProfile();
  const saved = parseBirthDate(profile.birthDate);
  const [birth, setBirth] = useState<Date | null>(saved);
  const [chosen, setChosen] = useState(Boolean(saved));
  const [guardian, setGuardian] = useState(profile.guardianAccepted);
  const [open, setOpen] = useState(false);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const band = chosen && birth ? ageBand(birthDateKey(birth)) : null;
  const blocked = band === 'blocked';
  const teen = band === 'teen';
  const canContinue = band === 'adult' || (teen && guardian);

  function onPick(event: DateTimePickerEvent, date?: Date) {
    setOpen(false);
    if (event.type === 'dismissed' || !date) {
      return;
    }
    setBirth(date);
    setChosen(true);
    if (ageBand(birthDateKey(date)) !== 'teen') {
      setGuardian(false);
    }
  }

  async function continueNext() {
    if (!birth || !canContinue) {
      return;
    }
    await save({
      birthDate: birthDateKey(birth),
      ageConfirmed: true,
      guardianAccepted: teen,
    });
    router.push('/alta/permisos');
  }

  const label = birth && chosen
    ? new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }).format(birth)
    : 'Elegir fecha';

  return (
    <Screen
      step={1}
      total={5}
      title="¿Cuál es tu fecha de nacimiento?"
      subtitle="Con menos de 13 años no se crea la cuenta. De 13 a 17 entras con límites."
      onBack={() => router.back()}
      footer={<Button label="Seguir" disabled={!canContinue} onPress={continueNext} />}>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.row}>
        <Text style={styles.fieldLabel}>Fecha de nacimiento</Text>
        <Text style={chosen ? styles.value : styles.placeholder}>{label}</Text>
      </Pressable>
      {blocked ? <Text style={styles.blocked}>Con menos de 13 años no se abre la cuenta.</Text> : null}
      {teen ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: guardian }}
          onPress={() => setGuardian((value) => !value)}
          style={styles.row}>
          <View style={[styles.box, guardian ? styles.boxOn : null]}>
            {guardian ? <Text style={styles.mark}>✓</Text> : null}
          </View>
          <Text style={styles.checkLabel}>Un adulto responsable autoriza esta cuenta.</Text>
        </Pressable>
      ) : null}
      {teen ? <Text style={styles.note}>Hasta los 18 solo quedan Entreno y tu perfil. Salidas, Match y Mensajes no aparecen.</Text> : null}
      {open ? (
        <DateTimePicker
          value={birth ?? yearsAgo(18)}
          mode="date"
          maximumDate={new Date()}
          minimumDate={new Date(1920, 0, 1)}
          onChange={onPick}
        />
      ) : null}
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
    fieldLabel: {
      color: colors.muted,
      fontSize: 14,
    },
    value: {
      flex: 1,
      color: colors.ink,
      fontSize: 16,
      textAlign: 'right',
    },
    placeholder: {
      flex: 1,
      color: colors.placeholder,
      fontSize: 16,
      textAlign: 'right',
    },
    blocked: {
      color: colors.danger,
      fontSize: 15,
      lineHeight: 21,
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
    checkLabel: {
      flex: 1,
      color: colors.ink,
      fontSize: 16,
    },
    note: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
    },
  });
}
