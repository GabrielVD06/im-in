import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeSwap } from '@/components/fade-swap';
import { PageSwitch } from '@/components/page-switch';
import { space, useColors, type Palette } from '@/theme/colors';
import { useFrame } from '@/ui/use-frame';

export default function MensajesScreen() {
  const colors = useColors();
  const frame = useFrame();
  const styles = useMemo(() => createStyles(colors, frame.gutter), [colors, frame.gutter]);
  const [page, setPage] = useState<'inbox' | 'requests'>('inbox');

  const inbox = (
    <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      <Text style={styles.section}>Grupos</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.railScroll} contentContainerStyle={styles.rail}>
        <View style={styles.circleSlot}>
          <View style={styles.circle}>
            <Text style={styles.circleMark}>+</Text>
          </View>
          <Text style={styles.circleLabel} numberOfLines={2}>
            Sin grupos
          </Text>
        </View>
      </ScrollView>
      <Text style={styles.section}>Directos</Text>
      <Text style={styles.emptyTitle}>Aún no hay conversaciones</Text>
      <Text style={styles.emptyBody}>Cuando quedes con alguien en Pasto, el mensaje aparece aquí, con el deporte y la hora.</Text>
    </ScrollView>
  );

  const requests = (
    <View style={styles.requestWrap}>
      <Text style={styles.emptyTitle}>Sin solicitudes</Text>
      <Text style={styles.emptyBody}>Una invitación privada llega a esta página. No se publica en Salidas.</Text>
    </View>
  );

  return (
    <View style={styles.frame}>
      <SafeAreaView style={[styles.safe, frame.wide && !frame.tablet ? styles.safeWide : null]} edges={['top', 'left', 'right']}>
        <View style={styles.body}>
          <View style={[styles.column, frame.tablet ? styles.columnTablet : null]}>
            <Text style={styles.title}>Mensajes</Text>
            <PageSwitch
              value={page}
              options={[
                { id: 'inbox', label: 'Mensajes' },
                { id: 'requests', label: 'Solicitudes' },
              ]}
              onChange={(id) => setPage(id === 'requests' ? 'requests' : 'inbox')}
            />
            <FadeSwap pageKey={page} style={styles.swap}>
              {page === 'inbox' ? inbox : requests}
            </FadeSwap>
          </View>
          {frame.tablet ? (
            <View style={styles.thread}>
              <Text style={styles.emptyTitle}>Elige una conversación</Text>
              <Text style={styles.emptyBody}>En la tableta el hilo se abre al lado. En el teléfono ocupa toda la pantalla.</Text>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

function createStyles(colors: Palette, gutter: number) {
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
    body: {
      flex: 1,
      flexDirection: 'row',
    },
    column: {
      flex: 1,
    },
    columnTablet: {
      flex: 0,
      width: 400,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: colors.line,
    },
    title: {
      color: colors.ink,
      fontSize: 32,
      lineHeight: 38,
      fontWeight: '700',
      paddingHorizontal: gutter,
      paddingTop: space.sm,
      paddingBottom: 4,
    },
    swap: {
      flex: 1,
    },
    list: {
      paddingBottom: space.xl,
      gap: 8,
    },
    section: {
      color: colors.ink,
      fontSize: 16,
      fontWeight: '700',
      paddingHorizontal: gutter,
      paddingTop: 16,
    },
    railScroll: {
      flexGrow: 0,
      height: 108,
    },
    rail: {
      paddingHorizontal: gutter,
      alignItems: 'flex-start',
      gap: 14,
      height: 108,
      flexGrow: 0,
    },
    circleSlot: {
      width: 76,
      alignItems: 'center',
      gap: 6,
      paddingTop: 8,
    },
    circle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    circleMark: {
      color: colors.muted,
      fontSize: 22,
      fontWeight: '500',
    },
    circleLabel: {
      color: colors.muted,
      fontSize: 12,
      textAlign: 'center',
    },
    emptyTitle: {
      color: colors.ink,
      fontSize: 18,
      fontWeight: '700',
      paddingHorizontal: gutter,
      paddingTop: 8,
    },
    emptyBody: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 22,
      paddingHorizontal: gutter,
    },
    requestWrap: {
      paddingTop: 28,
      gap: 6,
    },
    thread: {
      flex: 1,
      justifyContent: 'center',
      padding: 32,
      gap: 6,
    },
  });
}
