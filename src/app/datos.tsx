import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { SectionLabel } from '@/components/panel';
import { Screen } from '@/components/screen';
import { isRouteSport } from '@/domain/meetup';
import { SportMark } from '@/components/sport-marks';
import { LEVELS, MAX_SPORTS, SPORTS, bodyIndex, formatBodyIndex, sportName, type LevelId, type SportId } from '@/domain/profile';
import { routeMark } from '@/domain/route-goals';
import { useMeetups } from '@/state/meetup-context';
import { useProfile } from '@/state/profile-context';
import { useColors, type Palette } from '@/theme/colors';

export default function DatosScreen() {
  const { profile, save } = useProfile();
  const { meetups } = useMeetups();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [sports, setSports] = useState<{ sportId: SportId; level: LevelId | null }[]>(profile.sports);
  const [height, setHeight] = useState(profile.heightCm ? String(profile.heightCm) : '');
  const [weight, setWeight] = useState(profile.weightKg ? String(profile.weightKg) : '');
  const [message, setMessage] = useState('');

  function wholeNumber(value: string) {
    const digits = value.replace(/\D/g, '');
    return digits ? Number(digits) : null;
  }

  function selected(id: SportId) {
    return sports.find((sport) => sport.sportId === id);
  }

  function addSport(id: SportId) {
    setMessage('');
    setSports((current) => {
      if (current.some((sport) => sport.sportId === id)) {
        return current;
      }
      if (current.length >= MAX_SPORTS) {
        setMessage('Puedes marcar hasta dos deportes.');
        return current;
      }
      return [...current, { sportId: id, level: isRouteSport(id) ? null : 'intermedio' }];
    });
  }

  function removeSport(id: SportId) {
    setMessage('');
    setSports((current) => current.filter((sport) => sport.sportId !== id));
  }

  function setLevel(id: SportId, level: LevelId) {
    setMessage('');
    setSports((current) => current.map((sport) => (sport.sportId === id ? { ...sport, level } : sport)));
  }

  const heightCm = wholeNumber(height);
  const weightKg = wholeNumber(weight);
  const index =
    heightCm !== null && weightKg !== null && heightCm >= 120 && heightCm <= 220 && weightKg >= 35 && weightKg <= 220
      ? bodyIndex(heightCm, weightKg)
      : null;
  const available = SPORTS.filter((sport) => !selected(sport.id));

  async function saveDatos() {
    if (heightCm === null || weightKg === null || index === null) {
      setMessage('La estatura va de 120 a 220 cm y el peso de 35 a 220 kg.');
      return;
    }
    if (sports.length === 0 || sports.some((sport) => !isRouteSport(sport.sportId) && !sport.level)) {
      setMessage('Elige al menos un deporte. En pádel, fútbol y baloncesto marca el nivel.');
      return;
    }
    await save({
      heightCm,
      weightKg,
      sports: sports.map((sport) => ({
        sportId: sport.sportId,
        level: isRouteSport(sport.sportId) ? null : sport.level,
      })),
    });
    setMessage('Datos guardados.');
  }

  return (
    <Screen
      title="Datos"
      subtitle="Estatura, peso y deportes. En running y ciclismo el ritmo sale de tus recorridos."
      onBack={() => router.back()}
      footerMode="flow">
      <SectionLabel>Cuerpo</SectionLabel>
      <Text style={styles.hint}>Estatura y peso se leen juntos. Juntan ritmos de cuerpos parecidos. No son un nivel.</Text>
      <View style={styles.bodyRow}>
        <View style={styles.bodyField}>
          <Field label="Estatura (cm)" value={height} onChangeText={setHeight} placeholder="172" keyboardType="number-pad" autoCorrect={false} maxLength={3} />
        </View>
        <View style={styles.bodyField}>
          <Field label="Peso (kg)" value={weight} onChangeText={setWeight} placeholder="68" keyboardType="number-pad" autoCorrect={false} maxLength={3} />
        </View>
      </View>
      {index !== null ? (
        <Text style={styles.hint}>Relación {formatBodyIndex(index)}. Mientras más cerca esté entre dos personas, más parecido es el esfuerzo a un mismo ritmo.</Text>
      ) : null}

      <SectionLabel>Deportes</SectionLabel>
      <Text style={styles.hint}>Hasta dos. En pádel, fútbol y baloncesto eliges el nivel. En running y ciclismo lo marcan la distancia y el ritmo.</Text>
      {sports.length === 0 ? <Text style={styles.empty}>Todavía no marcaste un deporte.</Text> : null}
      {sports.map((sport) => {
        const route = isRouteSport(sport.sportId);
        const mark = route ? routeMark(meetups, sport.sportId) : null;
        return (
          <View key={sport.sportId} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardTitleRow}>
                <SportMark sport={sport.sportId} size={24} />
                <Text style={styles.cardTitle}>{sportName(sport.sportId)}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => removeSport(sport.sportId)}>
                <Text style={styles.remove}>Quitar</Text>
              </Pressable>
            </View>
            {mark ? (
              <View style={styles.mark}>
                <Text style={styles.markLabel}>{mark.label}</Text>
                <Text style={styles.hint}>{mark.detail}</Text>
              </View>
            ) : (
              <View style={styles.levels}>
                {LEVELS.map((level) => {
                  const on = sport.level === level.id;
                  return (
                    <Pressable
                      key={level.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() => setLevel(sport.sportId, level.id)}
                      style={[styles.level, on ? styles.levelOn : null]}>
                      <Text style={[styles.levelLabel, on ? styles.levelLabelOn : null]}>{level.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
      {available.length > 0 ? (
        <View style={styles.addRow}>
          {available.map((sport) => (
            <Pressable key={sport.id} accessibilityRole="button" onPress={() => addSport(sport.id)} style={styles.add}>
              <SportMark sport={sport.id} size={18} />
              <Text style={styles.addLabel}>{sport.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Button label="Guardar" onPress={saveDatos} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </Screen>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    hint: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
    },
    bodyRow: {
      flexDirection: 'row',
      gap: 8,
    },
    bodyField: {
      flex: 1,
    },
    empty: {
      color: colors.muted,
      fontSize: 15,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.line,
      padding: 14,
      gap: 8,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    cardTitleRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    cardTitle: {
      color: colors.ink,
      fontSize: 17,
      fontWeight: '600',
    },
    remove: {
      color: colors.muted,
      fontSize: 14,
      fontWeight: '500',
    },
    mark: {
      gap: 4,
    },
    markLabel: {
      color: colors.ink,
      fontSize: 16,
      fontWeight: '700',
    },
    levels: {
      flexDirection: 'row',
      gap: 6,
    },
    level: {
      flex: 1,
      minHeight: 36,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    levelOn: {
      backgroundColor: colors.action,
      borderColor: colors.action,
    },
    levelLabel: {
      color: colors.ink,
      fontSize: 12,
      fontWeight: '600',
    },
    levelLabelOn: {
      color: colors.onAction,
    },
    addRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    add: {
      minHeight: 36,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    addLabel: {
      color: colors.ink,
      fontSize: 14,
      fontWeight: '500',
    },
    message: {
      color: colors.action,
      fontSize: 14,
      lineHeight: 20,
    },
  });
}
