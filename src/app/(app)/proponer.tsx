import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Choice, Pill } from '@/components/button';
import { CityMap, type MapMarker } from '@/components/city-map';
import { Field } from '@/components/field';
import { InfoCard } from '@/components/panel';
import { Screen } from '@/components/screen';
import { PASTO, PLACES, placeNameNear, type LatLng } from '@/domain/geo';
import { WHEN_OPTIONS, isRouteSport } from '@/domain/meetup';
import { consentAccepted, levelName, sportName, type SportId } from '@/domain/profile';
import { routeMark } from '@/domain/route-goals';
import { useMeetups } from '@/state/meetup-context';
import { useProfile } from '@/state/profile-context';
import { useDeviceLocation } from '@/state/use-device-location';
import { space, useColors, type Palette } from '@/theme/colors';

const EMPTY_MARKERS: MapMarker[] = [];

export default function ProponerScreen() {
  const { profile } = useProfile();
  const { add, meetups } = useMeetups();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const allowed = consentAccepted(profile, 'location');
  const { locate } = useDeviceLocation();
  const [sportId, setSportId] = useState<SportId | null>(profile.sports[0]?.sportId ?? null);
  const [whenLabel, setWhenLabel] = useState<string>(WHEN_OPTIONS[0]);
  const [note, setNote] = useState('');
  const [center, setCenter] = useState<LatLng>(PASTO);
  const [focus, setFocus] = useState<(LatLng & { token: number }) | null>({ ...PASTO, token: 1 });
  const [message, setMessage] = useState('');

  const sport = profile.sports.find((item) => item.sportId === sportId) ?? null;

  function jump(next: LatLng) {
    setCenter(next);
    setFocus({ ...next, token: Date.now() });
  }

  async function publish() {
    if (!sport) {
      setMessage('Elige uno de tus deportes.');
      return;
    }
    const placeName = placeNameNear(center);
    await add({
      id: `${Date.now()}`,
      sportId: sport.sportId,
      level: sport.level,
      whenLabel,
      placeName,
      latitude: center.latitude,
      longitude: center.longitude,
      note: note.trim(),
      hostName: [profile.name, profile.lastName].filter(Boolean).join(' '),
      hostUsername: profile.username,
      createdAt: new Date().toISOString(),
    });
    router.replace('/salidas');
  }

  if (profile.sports.length === 0) {
    return (
      <Screen title="Publicar salida" subtitle="Sale de un deporte que ya practicas." onBack={() => router.back()}>
        <InfoCard kicker="Tu plan" title="Elige un deporte antes" body="Márcalo en Tú y vuelve aquí para poner hora y lugar." />
      </Screen>
    );
  }

  return (
    <Screen
      title="Publicar salida"
      subtitle="Mueve el mapa: el punto del centro es el lugar. La salida queda en este teléfono."
      onBack={() => router.back()}
      footer={<Button label="Publicar salida" onPress={publish} />}
      footerMode="flow">
      <Text style={styles.label}>Deporte</Text>
      {profile.sports.map((item) => (
        <Choice
          key={item.sportId}
          label={sportName(item.sportId)}
          detail={isRouteSport(item.sportId) ? routeMark(meetups, item.sportId).label : levelName(item.level)}
          selected={item.sportId === sportId}
          onPress={() => setSportId(item.sportId)}
        />
      ))}
      <Text style={styles.label}>Hora</Text>
      <View style={styles.wrap}>
        {WHEN_OPTIONS.map((option) => (
          <Choice key={option} label={option} selected={whenLabel === option} onPress={() => setWhenLabel(option)} style={styles.when} />
        ))}
      </View>
      <Text style={styles.label}>Lugar</Text>
      <ScrollPlaces onJump={jump} onMine={allowed ? async () => { const next = await locate(); if (next) jump(next); } : undefined} styles={styles} />
      <View style={styles.map}>
        <CityMap markers={EMPTY_MARKERS} focus={focus} showCenterPin onCenter={setCenter} />
      </View>
      <Text style={styles.place}>{placeNameNear(center)}</Text>
      <Field label="Nota" value={note} onChangeText={setNote} placeholder="Por ejemplo: ritmo suave, llevo balón" maxLength={80} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </Screen>
  );
}

function ScrollPlaces({
  onJump,
  onMine,
  styles,
}: {
  onJump: (point: LatLng) => void;
  onMine?: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.places}>
      {onMine ? <Pill label="Mi ubicación" onPress={onMine} /> : null}
      {PLACES.map((place) => (
        <Pill key={place.id} label={place.name} onPress={() => onJump(place.point)} />
      ))}
    </View>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    label: {
      color: colors.ink,
      fontSize: 14,
      fontWeight: '500',
      marginTop: space.xs,
    },
    wrap: {
      gap: 8,
    },
    when: {
      paddingVertical: 10,
    },
    places: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    map: {
      height: 280,
    },
    place: {
      color: colors.muted,
      fontSize: 14,
    },
    message: {
      color: colors.danger,
      fontSize: 14,
    },
  });
}
