import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CityMap } from '@/components/city-map';
import { effortFacts } from '@/domain/profile-feed';
import type { Meetup } from '@/domain/meetup';
import { formatClock, raceReport, type RaceReport, type TimedPoint } from '@/state/use-trace';
import { space, useColors, type Palette } from '@/theme/colors';

const EMPTY_MARKERS: [] = [];

type EffortSummaryProps = {
  meetup: Meetup | null;
  onClose: () => void;
  onDelete: (id: string) => void;
};

type SplitRow = {
  key: string;
  label: string;
  seconds: number;
  speed: string;
  ratio: number;
};

export function EffortSummary({ meetup, onClose, onDelete }: EffortSummaryProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const expanded = insets.top + 56;
  const resting = Math.round(height * 0.4);
  const mapFocus = Math.round(height * 0.64);
  const top = useSharedValue(resting);
  const dragStart = useSharedValue(resting);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    top.value = resting;
    setMenu(false);
  }, [meetup?.id, resting, top]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          dragStart.value = top.value;
        })
        .onUpdate((event) => {
          const next = dragStart.value + event.translationY;
          top.value = Math.min(mapFocus, Math.max(expanded, next));
        })
        .onEnd((event) => {
          let dest = resting;
          if (event.velocityY < -700) {
            dest = expanded;
          } else if (event.velocityY > 700) {
            dest = mapFocus;
          } else {
            const stops = [expanded, resting, mapFocus];
            dest = stops.reduce((best, stop) => (Math.abs(stop - top.value) < Math.abs(best - top.value) ? stop : best), resting);
          }
          top.value = withTiming(dest, { duration: 240 });
        }),
    [dragStart, expanded, mapFocus, resting, top],
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: top.value }],
    height: height - top.value,
  }));

  if (!meetup) {
    return null;
  }

  const facts = effortFacts(meetup);
  const points = (meetup.path?.points ?? []) as TimedPoint[];
  const elapsed = points[points.length - 1]?.elapsed ?? 0;
  const report = points.length > 1 ? raceReport([points.map((point) => ({ ...point, elapsed: point.elapsed ?? 0 }))], elapsed) : null;
  const rows = report && elapsed > 0 ? splitRows(report) : [];
  const paceTitle = meetup.sportId === 'cycle' ? 'Velocidad' : 'Ritmo';
  const lines = points.length > 1 ? [{ from: points[0], to: points[points.length - 1], points }] : [];
  const steps = typeof meetup.path?.steps === 'number' ? String(meetup.path.steps) : null;

  const askDelete = () => {
    setMenu(false);
    const published = meetup.audience && meetup.audience !== 'solo';
    Alert.alert('Eliminar entreno', published ? 'Se quita de tu perfil y también de Salidas.' : 'Se quita de tu perfil.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => onDelete(meetup.id) },
    ]);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={styles.fill}>
        <View style={styles.fill}>
          <CityMap markers={EMPTY_MARKERS} lines={lines} rounded={false} />
          <Animated.View style={[styles.sheet, { backgroundColor: colors.paper }, sheetStyle]}>
            <GestureDetector gesture={pan}>
              <View style={styles.grab}>
                <View style={[styles.handle, { backgroundColor: colors.line }]} />
                <Text style={[styles.title, { color: colors.ink }]}>{facts.title}</Text>
                <Text style={[styles.when, { color: colors.muted }]}>{facts.when}</Text>
                <View style={styles.stats}>
                  <Stat label="Distancia" value={facts.distance} />
                  <Stat label="Tiempo" value={facts.time ?? '—'} />
                  <Stat label={paceTitle} value={facts.pace ?? '—'} />
                  {steps ? <Stat label="Pasos" value={steps} /> : null}
                </View>
              </View>
            </GestureDetector>
            <ScrollView style={styles.splits} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
              <View style={styles.splitHead}>
                <Text style={[styles.section, { color: colors.ink }]}>Kilómetros</Text>
                <Text style={[styles.headTime, { color: colors.muted }]}>Tiempo</Text>
              </View>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <View key={row.key} style={styles.splitRow}>
                    <Text style={[styles.km, { color: colors.ink }]}>{row.label}</Text>
                    <View style={[styles.track, { backgroundColor: colors.actionSoft }]}>
                      <View style={[styles.bar, { width: `${Math.round(row.ratio * 100)}%`, backgroundColor: colors.action }]} />
                    </View>
                    <View style={styles.timeCol}>
                      <Text style={[styles.time, { color: colors.ink }]}>{row.seconds > 0 ? formatClock(row.seconds * 1000) : '—'}</Text>
                      <Text style={[styles.speed, { color: colors.muted }]}>{row.speed}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={[styles.when, { color: colors.muted }]}>
                  {elapsed > 0
                    ? 'Este recorrido todavía no completa un kilómetro.'
                    : 'Este recorrido no guardó el tiempo de cada kilómetro.'}
                </Text>
              )}
              {steps ? null : (
                <Text style={[styles.note, { color: colors.muted }]}>Este recorrido no tiene conteo de pasos. Los próximos sí lo guardan si el teléfono lo permite.</Text>
              )}
            </ScrollView>
          </Animated.View>
          {menu ? <Pressable accessibilityLabel="Cerrar menú" onPress={() => setMenu(false)} style={styles.backdrop} /> : null}
          <View pointerEvents="box-none" style={[styles.topBar, { top: insets.top + 8 }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar entreno" onPress={onClose} style={[styles.round, { backgroundColor: colors.card }]}>
              <Text style={[styles.roundLabel, { color: colors.ink }]}>Cerrar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Más opciones"
              onPress={() => setMenu((open) => !open)}
              style={[styles.more, { backgroundColor: colors.card }]}>
              <Text style={[styles.moreLabel, { color: colors.ink }]}>•••</Text>
            </Pressable>
          </View>
          {menu ? (
            <View style={[styles.menu, { top: insets.top + 52, backgroundColor: colors.card }]}>
              <Pressable accessibilityRole="button" onPress={askDelete} style={styles.menuItem}>
                <Text style={[styles.menuLabel, { color: colors.danger }]}>Eliminar</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function splitRows(report: RaceReport): SplitRow[] {
  const full = report.splits.filter((split) => split.seconds > 0);
  const fastest = full.length > 0 ? Math.min(...full.map((split) => split.seconds)) : 0;
  const rows: SplitRow[] = report.splits.map((split) => ({
    key: `km-${split.km}`,
    label: String(split.km),
    seconds: split.seconds,
    speed: speedLabel(split.seconds),
    ratio: barRatio(split.seconds, fastest),
  }));
  if (report.remainderKm >= 0.05 && report.remainderMs > 0) {
    const pace = report.remainderMs / 1000 / report.remainderKm;
    rows.push({
      key: 'rest',
      label: partialLabel(report.remainderKm),
      seconds: Math.round(report.remainderMs / 1000),
      speed: remainderSpeed(report.remainderKm, report.remainderMs),
      ratio: barRatio(pace, fastest),
    });
  }
  return rows.some((row) => row.seconds > 0) ? rows : [];
}

function barRatio(seconds: number, fastest: number) {
  if (seconds <= 0) {
    return 0.12;
  }
  if (fastest <= 0) {
    return 1;
  }
  return Math.min(1, Math.max(0.12, fastest / seconds));
}

function partialLabel(km: number) {
  const text = km < 10 ? km.toFixed(1) : String(Math.round(km));
  return text.replace('.', ',');
}

function Stat({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={stylesStat.cell}>
      <Text style={[stylesStat.value, { color: colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[stylesStat.label, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

function speedLabel(seconds: number) {
  if (seconds <= 0) {
    return '—';
  }
  const speed = 3600 / seconds;
  const text = speed < 30 ? speed.toFixed(1) : String(Math.round(speed));
  return `${text.replace('.', ',')} km/h`;
}

function remainderSpeed(km: number, ms: number) {
  if (km <= 0 || ms <= 0) {
    return '—';
  }
  const speed = km / (ms / 3600000);
  const text = speed < 30 ? speed.toFixed(1) : String(Math.round(speed));
  return `${text.replace('.', ',')} km/h`;
}

const stylesStat = StyleSheet.create({
  cell: {
    flex: 1,
    gap: 2,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
  },
  label: {
    fontSize: 13,
  },
});

function createStyles(colors: Palette) {
  return StyleSheet.create({
    fill: {
      flex: 1,
      backgroundColor: colors.paper,
    },
    topBar: {
      position: 'absolute',
      left: 12,
      right: 12,
      zIndex: 5,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    round: {
      minHeight: 36,
      borderRadius: 999,
      paddingHorizontal: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    roundLabel: {
      fontSize: 14,
      fontWeight: '700',
    },
    more: {
      width: 40,
      height: 36,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moreLabel: {
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 1,
      marginTop: -4,
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 6,
    },
    menu: {
      position: 'absolute',
      right: 12,
      zIndex: 7,
      minWidth: 180,
      borderRadius: 16,
      overflow: 'hidden',
      elevation: 8,
    },
    menuItem: {
      minHeight: 48,
      paddingHorizontal: 16,
      justifyContent: 'center',
    },
    menuLabel: {
      fontSize: 16,
      fontWeight: '600',
    },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      zIndex: 2,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: space.lg,
      overflow: 'hidden',
    },
    grab: {
      gap: 6,
      paddingTop: 10,
      paddingBottom: 8,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      marginBottom: 6,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
    },
    when: {
      fontSize: 14,
      lineHeight: 20,
    },
    stats: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    splits: {
      flex: 1,
    },
    splitHead: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    section: {
      fontSize: 17,
      fontWeight: '700',
    },
    headTime: {
      fontSize: 13,
      fontWeight: '600',
      width: 72,
      textAlign: 'right',
    },
    splitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 52,
      gap: 10,
    },
    km: {
      width: 32,
      fontSize: 16,
      fontWeight: '700',
    },
    track: {
      flex: 1,
      height: 12,
      borderRadius: 6,
      overflow: 'hidden',
    },
    bar: {
      height: 12,
      borderRadius: 6,
    },
    timeCol: {
      width: 72,
      alignItems: 'flex-end',
    },
    time: {
      fontSize: 16,
      fontWeight: '700',
    },
    speed: {
      fontSize: 12,
    },
    note: {
      fontSize: 14,
      lineHeight: 20,
      marginTop: 12,
    },
  });
}
