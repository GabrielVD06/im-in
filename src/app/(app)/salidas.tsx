import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CityMap, type MapLine } from '@/components/city-map';
import { SportMark } from '@/components/sport-marks';
import { FadeSwap } from '@/components/fade-swap';
import { PageSwitch } from '@/components/page-switch';
import { Button, Pill } from '@/components/button';
import { PASTO, RADII_KM, distanceKm, formatDistance, type LatLng, type RadiusKm } from '@/domain/geo';
import { isPublicMeetup, isRouteSport, meetupPoint, planSummary, type Meetup } from '@/domain/meetup';
import { consentAccepted, levelName, sportName, upsertConsent } from '@/domain/profile';
import { traceSpeedCap } from '@/domain/trace-fix';
import { useMeetups } from '@/state/meetup-context';
import { useProfile } from '@/state/profile-context';
import { useDeviceLocation } from '@/state/use-device-location';
import { useStepCounter } from '@/state/use-step-counter';
import { segmentsLabel, segmentsLength, useTrace } from '@/state/use-trace';
import { space, useColors, type Palette } from '@/theme/colors';
import { setMapBearing, useMapBearing } from '@/theme/map-style';
import { useFrame } from '@/ui/use-frame';

function ago(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) {
    return 'ahora';
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} h`;
  }
  return `${Math.round(hours / 24)} d`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return 'S';
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function SalidasScreen() {
  const { profile, save } = useProfile();
  const { meetups, remove, update } = useMeetups();
  const colors = useColors();
  const frame = useFrame();
  const styles = useMemo(() => createStyles(colors, frame.gutter), [colors, frame.gutter]);
  const { point, heading, locate } = useDeviceLocation();
  const trace = useTrace();
  const steps = useStepCounter(trace.active);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const locationOn = consentAccepted(profile, 'location');
  const [page, setPage] = useState<'public' | 'friends'>('public');
  const [showMap, setShowMap] = useState(false);
  const [radius, setRadius] = useState<RadiusKm>(5);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<LatLng>(PASTO);
  const [mapCenter, setMapCenter] = useState<LatLng>(PASTO);
  const [focus, setFocus] = useState<(LatLng & { token: number }) | null>(null);
  const [followToken, setFollowToken] = useState(0);
  const bearingMode = useMapBearing();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locateMessage, setLocateMessage] = useState('');
  const mapBeside = frame.tablet && page === 'public';

  useEffect(() => {
    if (!locationOn) {
      return;
    }
    let alive = true;
    locate().then((next) => {
      if (!alive || !next) {
        return;
      }
      setSearch(next);
      setMapCenter(next);
      setFocus({ ...next, token: 1 });
    });
    return () => {
      alive = false;
    };
  }, [locate, locationOn]);

  const nearby = useMemo(() => {
    const text = query.trim().toLowerCase();
    return meetups
      .filter(isPublicMeetup)
      .map((meetup) => ({ meetup, km: distanceKm(search, meetupPoint(meetup)) }))
      .filter((item) => item.km <= radius)
      .filter((item) => {
        if (!text) {
          return true;
        }
        const haystack = `${item.meetup.placeName} ${sportName(item.meetup.sportId)} ${item.meetup.hostName}`.toLowerCase();
        return haystack.includes(text);
      })
      .sort((a, b) => a.km - b.km);
  }, [meetups, query, radius, search]);
  const markers = useMemo(
    () =>
      nearby.flatMap(({ meetup }) => {
        const start = { id: meetup.id, latitude: meetup.latitude, longitude: meetup.longitude, color: '#2457D6', sport: meetup.sportId };
        if (!meetup.finish) {
          return [start];
        }
        return [start, { id: meetup.id, latitude: meetup.finish.latitude, longitude: meetup.finish.longitude, color: '#E07A2F' }];
      }),
    [nearby],
  );
  const mapLines = useMemo(() => {
    if (!trackingId) {
      return [];
    }
    return trace.segments.flatMap((segment) =>
      segment.length > 1 ? [{ from: segment[0], to: segment[segment.length - 1], points: segment }] : [],
    );
  }, [trackingId, trace.segments]);
  const trackingMeetup = meetups.find((meetup) => meetup.id === trackingId) ?? null;
  const selected =
    nearby.find((item) => item.meetup.id === selectedId) ??
    (trackingMeetup && trackingMeetup.id === selectedId ? { meetup: trackingMeetup, km: distanceKm(search, meetupPoint(trackingMeetup)) } : null);
  const livePoint = trackingId && trace.live ? trace.live : point;
  const moved = distanceKm(search, mapCenter) > 0.3;

  function jump(next: LatLng) {
    setSearch(next);
    setMapCenter(next);
    setFocus({ ...next, token: Date.now() });
  }

  function ownMeetup(meetup: Meetup) {
    return !meetup.hostUsername || meetup.hostUsername === profile.username;
  }

  async function beginMeetup(meetup: Meetup) {
    if (trackingId && trackingId !== meetup.id) {
      await finishTracking();
    }
    setLocateMessage('');
    const next = await locate();
    if (!next) {
      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted' && !permission.canAskAgain) {
        await Linking.openSettings();
      }
      setLocateMessage(permission.status === 'granted' ? 'No pude leer el GPS. Inténtalo otra vez.' : 'Autoriza la ubicación para centrarte.');
      return;
    }
    if (!consentAccepted(profile, 'location')) {
      save({ consents: upsertConsent(profile, 'location', true) });
    }
    setSelectedId(meetup.id);
    setShowMap(true);
    setTrackingId(meetup.id);
    steps.reset();
    trace.start(next, traceSpeedCap(meetup.sportId));
    setFollowToken(Date.now());
  }

  async function finishTracking() {
    const traced = trace.end();
    const id = trackingId;
    const kept = traced.filter((segment) => segment.length > 1);
    const distanceKm = segmentsLength(kept);
    if (id && distanceKm > 0) {
      await update(id, {
        path: {
          distanceKm,
          points: kept.flat(),
          ...(steps.steps !== null ? { steps: steps.steps } : {}),
        },
      });
    }
    trace.clear();
    setTrackingId(null);
    setFollowToken(0);
  }

  function open(meetup: Meetup) {
    setSelectedId(meetup.id);
    setShowMap(true);
    setFocus({ latitude: meetup.latitude, longitude: meetup.longitude, token: Date.now() });
  }

  async function goToMe() {
    setLocateMessage('');
    const next = await locate();
    if (next) {
      await save({ consents: upsertConsent(profile, 'location', true) });
      jump(next);
      return;
    }
    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== 'granted' && !permission.canAskAgain) {
      await Linking.openSettings();
      return;
    }
    setLocateMessage(permission.status === 'granted' ? 'No pude leer el GPS. Inténtalo otra vez.' : 'Autoriza la ubicación para centrarte.');
  }

  const feed = (
    <FadeSwap pageKey={page} style={styles.swap}>
      {page === 'friends' ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Aún no hay amigos</Text>
          <Text style={styles.emptyBody}>Cuando quedes con alguien, sus salidas aparecen en esta página. Las abiertas siguen en Públicas.</Text>
        </View>
      ) : showMap && !frame.tablet ? (
        <View style={styles.mapWrap}>
          <MapPane
            markers={markers}
            lines={mapLines}
            point={livePoint}
            heading={heading}
            activityNote={trackingId ? `${segmentsLabel(trace.segments)} por donde vas` : undefined}
            onFinish={trackingId ? finishTracking : undefined}
            onStart={
              selected && ownMeetup(selected.meetup) && isRouteSport(selected.meetup.sportId) && trackingId !== selected.meetup.id
                ? () => beginMeetup(selected.meetup)
                : undefined
            }
            focus={focus}
            followToken={followToken}
            bearingMode={bearingMode}
            onUserMove={() => setFollowToken(0)}
            moved={moved}
            selected={selected}
            styles={styles}
            onCenter={setMapCenter}
            onSelect={setSelectedId}
            onLocate={trackingId ? () => setFollowToken(Date.now()) : goToMe}
            onSearchHere={() => setSearch(mapCenter)}
            onRemove={remove}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {nearby.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>{query.trim() ? 'Nada con ese nombre' : `No hay salidas en ${radius} km`}</Text>
              <Text style={styles.emptyBody}>Las públicas se arman en Entreno, con deporte, hora y lugar.</Text>
            </View>
          ) : (
            nearby.map(({ meetup, km }) => (
              <MeetupCard
                key={meetup.id}
                meetup={meetup}
                km={km}
                own={ownMeetup(meetup)}
                live={meetup.id === trackingId}
                styles={styles}
                onPress={() => open(meetup)}
                onStart={ownMeetup(meetup) && isRouteSport(meetup.sportId) && meetup.id !== trackingId ? () => beginMeetup(meetup) : undefined}
                onFinish={meetup.id === trackingId ? finishTracking : undefined}
                onRemove={() => remove(meetup.id)}
              />
            ))
          )}
          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>Aún no hay carreras en Pasto</Text>
            <Text style={styles.noteBody}>Cuando haya una, podrás marcar que vas. Eso no es un pago.</Text>
          </View>
        </ScrollView>
      )}
    </FadeSwap>
  );

  return (
    <View style={styles.frame}>
      <SafeAreaView style={[styles.safe, frame.wide && !frame.tablet ? styles.safeWide : null]} edges={['top', 'left', 'right']}>
        <View style={styles.body}>
          <View style={[styles.column, mapBeside ? styles.columnTablet : null]}>
            <View style={styles.header}>
              <Text style={styles.title}>Salidas</Text>
              <Text style={styles.subtitle}>{point ? 'Cerca de ti, en Pasto.' : 'Activa la ubicación para ver las que te quedan cerca.'}</Text>
              {locateMessage ? <Text style={styles.note}>{locateMessage}</Text> : null}
            </View>
            <PageSwitch
              value={page}
              options={[
                { id: 'public', label: 'Públicas' },
                { id: 'friends', label: 'Amigos' },
              ]}
              onChange={(id) => {
                setPage(id === 'friends' ? 'friends' : 'public');
                if (id === 'friends') {
                  setShowMap(false);
                }
              }}
            />
            {page === 'public' ? (
              <View style={styles.tools}>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Buscar lugar o deporte"
                  placeholderTextColor={colors.placeholder}
                  style={styles.search}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                <View style={[styles.toolRow, showMap ? styles.toolRowMap : null]}>
                  {showMap ? null : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.radiiScroll} contentContainerStyle={styles.radii}>
                      {RADII_KM.map((value) => (
                        <Pill key={value} label={`${value} km`} selected={radius === value} onPress={() => setRadius(value)} />
                      ))}
                    </ScrollView>
                  )}
                  {frame.tablet ? null : (
                    <Pressable accessibilityRole="button" onPress={() => setShowMap((current) => !current)} style={styles.mapLink}>
                      <Text style={styles.mapLinkLabel}>{showMap ? 'Lista' : 'Mapa'}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ) : null}
            {feed}
          </View>
          {mapBeside ? (
            <View style={styles.mapPane}>
              <MapPane
                markers={markers}
            lines={mapLines}
                point={livePoint}
            heading={heading}
            activityNote={trackingId ? `${segmentsLabel(trace.segments)} por donde vas` : undefined}
            onFinish={trackingId ? finishTracking : undefined}
            onStart={
              selected && ownMeetup(selected.meetup) && isRouteSport(selected.meetup.sportId) && trackingId !== selected.meetup.id
                ? () => beginMeetup(selected.meetup)
                : undefined
            }
                focus={focus}
                followToken={followToken}
                bearingMode={bearingMode}
                onUserMove={() => setFollowToken(0)}
                moved={moved}
                selected={selected}
                styles={styles}
                onCenter={setMapCenter}
                onSelect={setSelectedId}
                onLocate={trackingId ? () => setFollowToken(Date.now()) : goToMe}
                onSearchHere={() => setSearch(mapCenter)}
                onRemove={remove}
              />
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

function MapPane({
  markers,
  lines,
  point,
  heading,
  focus,
  followToken,
  bearingMode,
  onUserMove,
  moved,
  selected,
  activityNote,
  styles,
  onCenter,
  onSelect,
  onLocate,
  onSearchHere,
  onRemove,
  onStart,
  onFinish,
}: {
  markers: { id: string; latitude: number; longitude: number; color?: string }[];
  lines: MapLine[];
  point: LatLng | null;
  heading: number | null;
  focus: (LatLng & { token: number }) | null;
  followToken: number;
  bearingMode: 'north' | 'heading';
  onUserMove: () => void;
  moved: boolean;
  selected: { meetup: Meetup; km: number } | null;
  activityNote?: string;
  styles: ReturnType<typeof createStyles>;
  onCenter: (point: LatLng) => void;
  onSelect: (id: string) => void;
  onLocate: () => void;
  onSearchHere: () => void;
  onRemove: (id: string) => void;
  onStart?: () => void;
  onFinish?: () => void;
}) {
  return (
    <View style={styles.mapWrap}>
      <CityMap
        markers={markers}
        lines={lines}
        me={point}
        heading={heading}
        focus={focus}
        followToken={followToken}
        bearingMode={bearingMode}
        onUserMove={onUserMove}
        rounded={false}
        onCenter={onCenter}
        onSelect={onSelect}
      />
      <View style={styles.mapTools}>
        <Pill label={followToken > 0 ? 'Siguiendo' : point ? 'Mi ubicación' : 'Activar ubicación'} onPress={onLocate} selected={followToken > 0} />
        {onFinish ? (
          <Pill
            label={bearingMode === 'heading' ? 'Rumbo' : 'Norte'}
            selected={bearingMode === 'heading'}
            onPress={() => {
              const next = bearingMode === 'heading' ? 'north' : 'heading';
              setMapBearing(next);
              if (followToken <= 0) onLocate();
            }}
          />
        ) : null}
        {moved ? <Pill label="Buscar aquí" tone="solid" onPress={onSearchHere} /> : null}
      </View>
      {selected || onFinish ? (
        <View style={styles.sheet}>
          {activityNote ? <Text style={styles.planNote}>{activityNote}</Text> : null}
          {onFinish ? <Button label="Terminar" size="compact" onPress={onFinish} /> : null}
          {onStart ? <Button label="Iniciar" size="compact" onPress={onStart} /> : null}
          {selected ? <MeetupCard meetup={selected.meetup} km={selected.km} own={false} styles={styles} /> : null}
          {selected ? <Button label="Quitar esta salida" variant="quiet" size="compact" onPress={() => onRemove(selected.meetup.id)} /> : null}
        </View>
      ) : null}
    </View>
  );
}

function MeetupCard({
  meetup,
  km,
  own,
  live,
  onPress,
  onStart,
  onFinish,
  onRemove,
  styles,
}: {
  meetup: Meetup;
  km: number;
  own: boolean;
  live?: boolean;
  onPress?: () => void;
  onStart?: () => void;
  onFinish?: () => void;
  onRemove?: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const plan = planSummary(meetup);
  const body = (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLabel}>{initials(meetup.hostName)}</Text>
        </View>
        <View style={styles.cardIdentity}>
          <Text style={styles.host} numberOfLines={1}>
            {meetup.hostName || 'Alguien en Pasto'}
          </Text>
          <View style={styles.sportLine}>
            <SportMark sport={meetup.sportId} size={16} />
            <Text style={styles.meta} numberOfLines={1}>
              {isRouteSport(meetup.sportId) || !meetup.level ? sportName(meetup.sportId) : `${sportName(meetup.sportId)} · ${levelName(meetup.level)}`}
            </Text>
          </View>
        </View>
        <Text style={styles.time}>{ago(meetup.createdAt)}</Text>
      </View>
      <View style={styles.plan}>
        <Text style={styles.place}>{meetup.placeName}</Text>
        <Text style={styles.planMeta}>
          {meetup.whenLabel} · a {formatDistance(km)}
        </Text>
        {plan ? <Text style={styles.planNote}>{plan}</Text> : null}
        {meetup.path && meetup.path.points.length > 1 ? <Text style={styles.planNote}>Recorrido · {formatDistance(meetup.path.distanceKm)}</Text> : null}
        {meetup.note ? <Text style={styles.planNote}>{meetup.note}</Text> : null}
      </View>
      {live ? <Text style={styles.startLabel}>En curso</Text> : null}
      {onStart ? (
        <Pressable accessibilityRole="button" onPress={onStart} style={styles.remove}>
          <Text style={styles.startLabel}>Iniciar</Text>
        </Pressable>
      ) : null}
      {onFinish ? (
        <Pressable accessibilityRole="button" onPress={onFinish} style={styles.remove}>
          <Text style={styles.startLabel}>Terminar</Text>
        </Pressable>
      ) : null}
      {own && onRemove ? (
        <Pressable accessibilityRole="button" onPress={onRemove} style={styles.remove}>
          <Text style={styles.removeLabel}>Quitar</Text>
        </Pressable>
      ) : null}
    </View>
  );
  if (!onPress) {
    return body;
  }
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => (pressed ? styles.pressed : null)}>
      {body}
    </Pressable>
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
      width: 420,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: colors.line,
    },
    header: {
      paddingHorizontal: gutter,
      paddingTop: space.sm,
      paddingBottom: 4,
      gap: 2,
    },
    title: {
      color: colors.ink,
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '700',
    },
    subtitle: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
    },
    note: {
      color: colors.action,
      fontSize: 14,
      lineHeight: 20,
    },
    tools: {
      paddingHorizontal: gutter,
      paddingTop: 12,
      gap: 10,
    },
    search: {
      height: 44,
      borderRadius: 22,
      paddingHorizontal: 16,
      backgroundColor: colors.card,
      color: colors.ink,
      fontSize: 15,
    },
    toolRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    toolRowMap: {
      justifyContent: 'flex-end',
    },
    radiiScroll: {
      flex: 1,
      flexGrow: 1,
      height: 40,
    },
    radii: {
      alignItems: 'center',
      gap: 8,
      height: 40,
      flexGrow: 0,
    },
    mapLink: {
      minHeight: 40,
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    mapLinkLabel: {
      color: colors.action,
      fontSize: 15,
      fontWeight: '600',
    },
    swap: {
      flex: 1,
    },
    list: {
      paddingHorizontal: gutter,
      paddingTop: 12,
      paddingBottom: space.xl,
      gap: 12,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 22,
      padding: 14,
      gap: 12,
    },
    pressed: {
      opacity: 0.82,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.photo,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarLabel: {
      color: colors.onPhoto,
      fontSize: 14,
      fontWeight: '700',
    },
    cardIdentity: {
      flex: 1,
      gap: 1,
    },
    host: {
      color: colors.ink,
      fontSize: 15,
      fontWeight: '700',
    },
    sportLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    meta: {
      color: colors.muted,
      fontSize: 13,
      flex: 1,
    },
    time: {
      color: colors.muted,
      fontSize: 12,
    },
    plan: {
      borderRadius: 16,
      backgroundColor: colors.paper,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 3,
    },
    place: {
      color: colors.ink,
      fontSize: 17,
      fontWeight: '700',
    },
    planMeta: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
    },
    planNote: {
      color: colors.ink,
      fontSize: 14,
      lineHeight: 20,
    },
    remove: {
      alignSelf: 'flex-start',
      minHeight: 32,
      justifyContent: 'center',
    },
    removeLabel: {
      color: colors.danger,
      fontSize: 14,
      fontWeight: '600',
    },
    startLabel: {
      color: colors.action,
      fontSize: 14,
      fontWeight: '700',
    },
    emptyWrap: {
      margin: gutter,
      marginTop: 28,
      gap: 6,
    },
    emptyTitle: {
      color: colors.ink,
      fontSize: 20,
      fontWeight: '700',
    },
    emptyBody: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 22,
    },
    noteCard: {
      paddingVertical: 8,
      gap: 4,
    },
    noteTitle: {
      color: colors.ink,
      fontSize: 15,
      fontWeight: '600',
    },
    noteBody: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
    },
    mapPane: {
      flex: 1,
    },
    mapWrap: {
      flex: 1,
    },
    mapTools: {
      position: 'absolute',
      top: 12,
      left: 12,
      right: 64,
      flexDirection: 'row',
      gap: 8,
    },
    sheet: {
      position: 'absolute',
      left: 12,
      right: 12,
      bottom: 12,
      gap: 8,
    },
  });
}
