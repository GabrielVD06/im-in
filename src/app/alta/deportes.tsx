import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Choice } from '@/components/button';
import { Screen } from '@/components/screen';
import { isRouteSport } from '@/domain/meetup';
import { SportMark } from '@/components/sport-marks';
import { LEVELS, MAX_SPORTS, SPORTS, type LevelId, type SportId } from '@/domain/profile';
import { useProfile } from '@/state/profile-context';
import { useColors, type Palette } from '@/theme/colors';

export default function DeportesScreen() {
  const { profile, save } = useProfile();
  const [sports, setSports] = useState<{ sportId: SportId; level: LevelId | null }[]>(profile.sports);
  const [message, setMessage] = useState('');
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  function selected(id: SportId) {
    return sports.find((sport) => sport.sportId === id);
  }

  function toggleSport(id: SportId) {
    setMessage('');
    setSports((current) => {
      const exists = current.some((sport) => sport.sportId === id);
      if (exists) {
        return current.filter((sport) => sport.sportId !== id);
      }
      if (current.length >= MAX_SPORTS) {
        setMessage('En esta versión puedes marcar hasta dos deportes.');
        return current;
      }
      return [...current, { sportId: id, level: null }];
    });
  }

  function setLevel(id: SportId, level: LevelId) {
    setSports((current) => current.map((sport) => (sport.sportId === id ? { ...sport, level } : sport)));
  }

  async function continueNext() {
    if (sports.length === 0 || sports.some((sport) => !isRouteSport(sport.sportId) && !sport.level)) {
      setMessage('Elige al menos un deporte. En pádel, fútbol y baloncesto marca el nivel.');
      return;
    }
    await save({
      sports: sports.map((sport) => ({
        sportId: sport.sportId,
        level: isRouteSport(sport.sportId) ? null : sport.level,
      })),
    });
    router.push('/alta/foto');
  }

  return (
    <Screen
      step={4}
      total={5}
      title="¿Qué practicas?"
      subtitle="Elige uno o dos. En running y ciclismo el nivel sale de tus recorridos."
      onBack={() => router.back()}
      footer={<Button label="Seguir" onPress={continueNext} />}>
      {SPORTS.map((sport) => {
        const choice = selected(sport.id);
        return (
          <View key={sport.id} style={styles.block}>
            <Choice label={sport.name} selected={Boolean(choice)} onPress={() => toggleSport(sport.id)} icon={<SportMark sport={sport.id} size={26} />} />
            {choice && isRouteSport(sport.id) ? (
              <Text style={styles.routeNote}>La distancia y el ritmo se arman con tus salidas.</Text>
            ) : null}
            {choice && !isRouteSport(sport.id) ? (
              <View style={styles.levels}>
                {LEVELS.map((level) => {
                  const on = choice.level === level.id;
                  return (
                    <Pressable
                      key={level.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() => setLevel(sport.id, level.id)}
                      style={[styles.level, on ? styles.levelOn : null]}>
                      <Text style={[styles.levelLabel, on ? styles.levelLabelOn : null]}>{level.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </Screen>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    block: {
      gap: 8,
    },
    routeNote: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
      paddingHorizontal: 4,
    },
    levels: {
      flexDirection: 'row',
      gap: 6,
    },
    level: {
      flex: 1,
      minHeight: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.card,
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
      textAlign: 'center',
    },
    levelLabelOn: {
      color: colors.onAction,
    },
    message: {
      color: colors.danger,
      fontSize: 14,
    },
  });
}
