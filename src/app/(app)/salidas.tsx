import * as Location from 'expo-location';
import { Redirect } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CityMap, type MapLine } from '@/components/city-map';
import { SportMark } from '@/components/sport-marks';
import { FadeSwap } from '@/components/fade-swap';
import { PageSwitch } from '@/components/page-switch';
import { Button, Pill } from '@/components/button';
import { displayCity } from '@/domain/cities';
import { PASTO, RADII_KM, distanceKm, formatDistance, type LatLng, type RadiusKm } from '@/domain/geo';
import { canBeginMeetup, isPublicMeetup, isRouteSport, meetupPoint, planSummary, type Meetup } from '@/domain/meetup';
import { SPORTS, consentAccepted, isAdultAccount, levelName, sportName, upsertConsent, type SportId } from '@/domain/profile';
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
  const city = displayCity(profile.city);
  const trace = useTrace();
  const steps = useStepCounter(trace.active);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const locationOn = consentAccepted(profile, 'location');
  const [page, setPage] = useState<'public' | 'friends' | 'events'>('public');
  const [now, setNow] = useState(() => Date.now());
  const [showMap, setShowMap] = useState(false);
  const [radius, setRadius] = useState<RadiusKm>(5);
  const [query, setQuery] = useState('');
  const [sportFilter, setSportFilter] = useState<SportId | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState<LatLng>(PASTO);
  const [focus, setFocus] = useState<(LatLng & { token: number }) | null>(null);
  const [followToken, setFollowToken] = useState(0);
  const bearingMode = useMapBearing();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locateMessage, setLocateMessage] = useState('');
  const mapBeside = frame.tablet && page === 'public';
  const mapOpen = showMap && !frame.tablet;

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
  const mapped = useMemo(() => {
    if (page !== 'public') {
      return [];
    }
    const anchor = point ?? search;
    return meetups
      .filter(isPublicMeetup)
      .filter((meetup) => !sportFilter || meetup.sportId === sportFilter)
      .map((meetup) => ({ meetup, km: distanceKm(anchor, meetupPoint(meetup)) }))
      .sort((a, b) => a.km - b.km);
  }, [page, meetups, point, search, sportFilter]);
  const markers = useMemo(
    () =>
      mapped.flatMap(({ meetup }) => {
        const start = { id: meetup.id, latitude: meetup.latitude, longitude: meetup.longitude, color: '#2457D6', sport: meetup.sportId };
        if (!meetup.finish) {
          return [start];
        }
        return [start, { id: meetup.id, latitude: meetup.finish.latitude, longitude: meetup.finish.longitude, color: '#E07A2F' }];
      }),
    [mapped],
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
    mapped.find((item) => item.meetup.id === selectedId) ??
    (trackingMeetup && trackingMeetup.id === selectedId ? { meetup: trackingMeetup, km: distanceKm(point ?? search, meetupPoint(trackingMeetup)) } : null);
  const livePoint = trackingId && trace.live ? trace.live : point;

  function jump(next: LatLng) {
    setSearch(next);
    setFocus({ ...next, token: Date.now() });
  }

  function ownMeetup(meetup: Meetup) {
    return !meetup.hostUsername || meetup.hostUsername === profile.username;
  }

  function canStart(meetup: Meetup) {
    return ownMeetup(meetup) && isRouteSport(meetup.sportId) && trackingId !== meetup.id && canBeginMeetup(meetup, now);
  }

  function toggleGoing(meetup: Meetup) {
    void update(meetup.id, { going: !meetup.going });
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

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const filterLabel = page === 'friends' ? 'Amigos' : page === 'events' ? 'Eventos' : sportFilter ? sportName(sportFilter) : 'Filtro';
  const feed = (
    <FadeSwap pageKey={mapOpen ? 'map' : page} style={styles.swap}>
      {showMap && !frame.tablet ? (
        <View style={styles.mapWrap}>
          <MapPane
            markers={markers}
            lines={mapLines}
            point={livePoint}
            heading={heading}
            activityNote={trackingId ? `${segmentsLabel(trace.segments)} por donde vas` : undefined}
            onFinish={trackingId ? finishTracking : undefined}
            onStart={selected && canStart(selected.meetup) ? () => beginMeetup(selected.meetup) : undefined}
            own={selected ? ownMeetup(selected.meetup) : false}
            going={selected?.meetup.going}
            onJoin={selected && !ownMeetup(selected.meetup) ? () => toggleGoing(selected.meetup) : undefined}
            live={selected?.meetup.id === trackingId}
            focus={focus}
            followToken={followToken}
            bearingMode={bearingMode}
            onUserMove={() => setFollowToken(0)}
            selected={selected}
            styles={styles}
            onSelect={setSelectedId}
            onLocate={trackingId ? () => setFollowToken(Date.now()) : goToMe}
            onClose={() => setSelectedId(null)}
            onRemove={remove}
          />
        </View>
      ) : page === 'friends' ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Aún no hay amigos</Text>
          <Text style={styles.emptyBody}>Cuando tengas amigos, aquí ves sus posts, con imagen, y sus salidas.</Text>
        </View>
      ) : page === 'events' ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Aún no hay eventos</Text>
          <Text style={styles.emptyBody}>Las carreras y los eventos oficiales van aquí como posts, con imagen.</Text>
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
                onStart={canStart(meetup) ? () => beginMeetup(meetup) : undefined}
                onJoin={ownMeetup(meetup) ? undefined : () => toggleGoing(meetup)}
                going={meetup.going}
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

  if (!isAdultAccount(profile)) {
    return <Redirect href="/entreno" />;
  }

  return (
    <View style={styles.frame}>
      <SafeAreaView style={[styles.safe, frame.wide && !frame.tablet ? styles.safeWide : null]} edges={['top', 'left', 'right']}>
        <View style={styles.body}>
          <View style={[styles.column, mapBeside ? styles.columnTablet : null]}>
            <View style={[styles.header, mapOpen ? styles.headerMap : null]}>
              <Text style={[styles.title, mapOpen ? styles.titleMap : null]}>Salidas</Text>
              {mapOpen ? null : (
                <Text style={styles.subtitle}>{point ? `Cerca de ti, en ${city}.` : 'Activa la ubicación para ver las que te quedan cerca.'}</Text>
              )}
              {locateMessage ? <Text style={styles.note}>{locateMessage}</Text> : null}
            </View>
            {mapOpen ? (
              <View style={styles.brandRow}>
                <Text style={styles.brand}>I'm in</Text>
              </View>
            ) : (
              <PageSwitch
                value={page}
                options={[
                  { id: 'public', label: 'Públicas' },
                  { id: 'friends', label: 'Amigos' },
                  { id: 'events', label: 'Eventos' },
                ]}
                onChange={(id) => {
                  const next = id === 'friends' || id === 'events' ? id : 'public';
                  setPage(next);
                  setFilterOpen(false);
                  setShowMap(false);
                }}
              />
            )}
            {mapOpen || page === 'public' ? (
              <View style={[styles.tools, mapOpen ? styles.toolsMap : null, filterOpen ? styles.toolsFront : null]}>
                {mapOpen ? (
                  <>
                    <View style={styles.split}>
                      <View style={styles.filterSlot}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setFilterOpen((open) => !open)}
                          style={[styles.filterButton, page !== 'public' || sportFilter ? styles.splitButtonOn : null]}>
                          <Text style={styles.splitLabel}>{filterLabel}</Text>
                        </Pressable>
                        {filterOpen ? (
                          <View style={styles.filterMenu}>
                            {([
                              ['public', 'Públicas'],
                              ['friends', 'Amigos'],
                              ['events', 'Eventos'],
                            ] as const).map(([id, label]) => (
                              <Pressable
                                key={id}
                                accessibilityRole="button"
                                onPress={() => {
                                  setPage(id);
                                  if (id !== 'public') setSelectedId(null);
                                  setFilterOpen(false);
                                }}
                                style={[styles.filterOption, page === id ? styles.filterOptionOn : null]}>
                                <Text style={[styles.splitLabel, page === id ? styles.filterOptionLabelOn : null]}>{label}</Text>
                              </Pressable>
                            ))}
                            <View style={styles.filterDivider} />
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => {
                                setSportFilter(null);
                                setFilterOpen(false);
                              }}
                              style={[styles.filterOption, !sportFilter ? styles.filterOptionOn : null]}>
                              <Text style={[styles.splitLabel, !sportFilter ? styles.filterOptionLabelOn : null]}>Todo</Text>
                            </Pressable>
                            {SPORTS.map((sport) => (
                              <Pressable
                                key={sport.id}
                                accessibilityRole="button"
                                onPress={() => {
                                  setSportFilter(sport.id);
                                  setFilterOpen(false);
                                }}
                                style={[styles.filterOption, sportFilter === sport.id ? styles.filterOptionOn : null]}>
                                <Text style={[styles.splitLabel, sportFilter === sport.id ? styles.filterOptionLabelOn : null]}>{sport.name}</Text>
                              </Pressable>
                            ))}
                          </View>
                        ) : null}
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          setFilterOpen(false);
                          setShowMap(false);
                        }}
                        style={styles.splitButton}>
                        <Text style={styles.mapLinkLabel}>Lista</Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Buscar lugar o deporte"
                  placeholderTextColor={colors.placeholder}
                  style={styles.search}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                )}
                {mapOpen ? null : (
                  <View style={styles.toolRow}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.radiiScroll} contentContainerStyle={styles.radii}>
                      {RADII_KM.map((value) => (
                        <Pill key={value} label={`${value} km`} selected={radius === value} onPress={() => setRadius(value)} />
                      ))}
                    </ScrollView>
                    {frame.tablet ? null : (
                      <Pressable accessibilityRole="button" onPress={() => setShowMap(true)} style={styles.mapLink}>
                        <Text style={styles.mapLinkLabel}>Mapa</Text>
                      </Pressable>
                    )}
                  </View>
                )}
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
            onStart={selected && canStart(selected.meetup) ? () => beginMeetup(selected.meetup) : undefined}
            own={selected ? ownMeetup(selected.meetup) : false}
            going={selected?.meetup.going}
            onJoin={selected && !ownMeetup(selected.meetup) ? () => toggleGoing(selected.meetup) : undefined}
            live={selected?.meetup.id === trackingId}
                focus={focus}
                followToken={followToken}
                bearingMode={bearingMode}
                onUserMove={() => setFollowToken(0)}
                selected={selected}
                styles={styles}
                onSelect={setSelectedId}
                onLocate={trackingId ? () => setFollowToken(Date.now()) : goToMe}
                onClose={() => setSelectedId(null)}
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
  selected,
  own = false,
  going = false,
  live = false,
  activityNote,
  styles,
  onSelect,
  onLocate,
  onClose,
  onJoin,
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
  selected: { meetup: Meetup; km: number } | null;
  own?: boolean;
  going?: boolean;
  live?: boolean;
  activityNote?: string;
  styles: ReturnType<typeof createStyles>;
  onSelect: (id: string) => void;
  onLocate: () => void;
  onClose?: () => void;
  onJoin?: () => void;
  onRemove: (id: string) => void;
  onStart?: () => void;
  onFinish?: () => void;
}) {
  return (
    <View style={styles.mapFill}>
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
        onSelect={onSelect}
      />
      <View style={styles.mapTools}>
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
      </View>
      <View style={styles.dock} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={point ? 'Mi ubicación' : 'Activar ubicación'}
          onPress={onLocate}
          style={styles.locate}>
          <View style={styles.locateRing} />
          <View style={[styles.locateDot, followToken > 0 ? styles.locateDotOn : null]} />
        </Pressable>
        {selected || onFinish ? (
        <View style={styles.sheet}>
          {activityNote || onFinish ? (
            <View style={styles.sheetTools}>
              {activityNote ? <Text style={styles.planNote}>{activityNote}</Text> : null}
              {onFinish ? <Button label="Terminar" size="compact" onPress={onFinish} /> : null}
            </View>
          ) : null}
          {selected ? (
            <MeetupCard
              meetup={selected.meetup}
              km={selected.km}
              own={own}
              compact
              docked
              live={live}
              going={going}
              onStart={onStart}
              onJoin={onJoin}
              onClose={onClose}
              onRemove={own ? () => onRemove(selected.meetup.id) : undefined}
              styles={styles}
            />
          ) : null}
        </View>
      ) : null}
      </View>
    </View>
  );
}

function MeetupCard({
  meetup,
  km,
  own,
  compact = false,
  docked = false,
  live,
  going = false,
  onPress,
  onStart,
  onJoin,
  onClose,
  onFinish,
  onRemove,
  styles,
}: {
  meetup: Meetup;
  km: number;
  own: boolean;
  compact?: boolean;
  docked?: boolean;
  live?: boolean;
  going?: boolean;
  onPress?: () => void;
  onStart?: () => void;
  onJoin?: () => void;
  onClose?: () => void;
  onFinish?: () => void;
  onRemove?: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const plan = planSummary(meetup);
  const body = (
    <View style={[styles.card, compact ? styles.cardCompact : null, docked ? styles.cardDocked : null]}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLabel}>{initials(meetup.hostName)}</Text>
        </View>
        <View style={styles.cardIdentity}>
          <View style={styles.nameLine}>
            <Text style={styles.host} numberOfLines={1}>
              {meetup.hostName || 'Alguien en Pasto'}
            </Text>
            {onStart ? (
              <Pressable accessibilityRole="button" onPress={onStart} style={styles.nameAction}>
                <Text style={styles.nameActionLabel}>Iniciar</Text>
              </Pressable>
            ) : null}
            {onJoin ? (
              <Pressable accessibilityRole="button" onPress={onJoin} style={[styles.nameAction, going ? styles.nameActionOn : null]}>
                <Text style={[styles.nameActionLabel, going ? styles.nameActionLabelOn : null]}>I'm in</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.sportLine}>
            <SportMark sport={meetup.sportId} size={16} />
            <Text style={styles.meta} numberOfLines={1}>
              {isRouteSport(meetup.sportId) || !meetup.level ? sportName(meetup.sportId) : `${sportName(meetup.sportId)} · ${levelName(meetup.level)}`}
            </Text>
          </View>
        </View>
        <View style={styles.cardCorner}>
          <Text style={styles.time}>{ago(meetup.createdAt)}</Text>
          {onClose ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={styles.close}>
              <Text style={styles.closeLabel}>×</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={[styles.plan, compact ? styles.planCompact : null]}>
        <Text style={styles.place}>{meetup.placeName}</Text>
        <Text style={styles.planMeta}>
          {meetup.whenLabel} · a {formatDistance(km)}
        </Text>
        {plan ? <Text style={styles.planNote}>{plan}</Text> : null}
        {meetup.path && meetup.path.points.length > 1 ? <Text style={styles.planNote}>Recorrido · {formatDistance(meetup.path.distanceKm)}</Text> : null}
        {meetup.note ? <Text style={styles.planNote}>{meetup.note}</Text> : null}
      </View>
      {live ? <Text style={styles.startLabel}>En curso</Text> : null}
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
    headerMap: {
      paddingBottom: 0,
    },
    titleMap: {
      fontSize: 22,
      lineHeight: 26,
    },
    brandRow: {
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
    },
    brand: {
      color: colors.ink,
      fontSize: 32,
      lineHeight: 40,
      fontWeight: '700',
      fontStyle: 'italic',
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
    toolsMap: {
      paddingTop: 10,
      gap: 8,
      zIndex: 4,
    },
    toolsFront: {
      zIndex: 5,
      elevation: 12,
    },
    split: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    filterSlot: {
      flex: 1,
      minHeight: 40,
    },
    filterButton: {
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterMenu: {
      position: 'absolute',
      top: 48,
      left: 0,
      right: 0,
      gap: 8,
      zIndex: 6,
      elevation: 12,
    },
    filterDivider: {
      height: 1,
      backgroundColor: colors.line,
      marginVertical: 2,
    },
    filterOption: {
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterOptionOn: {
      backgroundColor: colors.actionSoft,
    },
    filterOptionLabelOn: {
      color: colors.action,
    },
    splitButton: {
      flex: 1,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    splitButtonOn: {
      backgroundColor: colors.actionSoft,
    },
    splitLabel: {
      color: colors.ink,
      fontSize: 15,
      fontWeight: '600',
    },
    toolRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
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
    cardCompact: {
      padding: 10,
      gap: 8,
      borderRadius: 18,
    },
    cardDocked: {
      marginHorizontal: 12,
      marginBottom: 10,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.line,
    },
    planCompact: {
      paddingVertical: 8,
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
      flexShrink: 1,
    },
    nameLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    nameAction: {
      minHeight: 28,
      paddingHorizontal: 10,
      borderRadius: 14,
      backgroundColor: colors.action,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nameActionOn: {
      backgroundColor: colors.actionSoft,
    },
    nameActionLabel: {
      color: colors.onAction,
      fontSize: 12,
      fontWeight: '700',
    },
    nameActionLabelOn: {
      color: colors.action,
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
    cardCorner: {
      alignItems: 'flex-end',
      gap: 4,
    },
    close: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.paper,
    },
    closeLabel: {
      color: colors.ink,
      fontSize: 20,
      lineHeight: 22,
      fontWeight: '500',
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
      overflow: 'hidden',
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: colors.line,
    },
    mapWrap: {
      flex: 1,
      overflow: 'hidden',
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: colors.line,
    },
    mapFill: {
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
    dock: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'flex-end',
    },
    locate: {
      width: 48,
      height: 48,
      borderRadius: 24,
      marginRight: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    locateRing: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: colors.action,
    },
    locateDot: {
      position: 'absolute',
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.action,
    },
    locateDotOn: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    sheet: {
      alignSelf: 'stretch',
      gap: 8,
    },
    sheetTools: {
      paddingHorizontal: 12,
    },
  });
}
