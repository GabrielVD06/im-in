import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Segment } from '@/components/button';
import { CityMap } from '@/components/city-map';
import { DistanceWheel } from '@/components/distance-wheel';
import { FadeSwap } from '@/components/fade-swap';
import { PASTO, distanceKm, formatDistance, placeNameNear, type LatLng } from '@/domain/geo';
import { describePoint, type ReferencePlace } from '@/domain/place-label';
import { searchPlaces, type PlaceHit } from '@/domain/place-search';
import { courtCapacity, isRouteSport, type MatchFormat, type MeetupAudience } from '@/domain/meetup';
import { routeGoals } from '@/domain/route-goals';
import { type RouteDistance } from '@/domain/route-distance';
import { defaultTargetMinutes, effortPaceLine, TARGET_MAX_MINUTES, TARGET_MIN_MINUTES } from '@/domain/route-pace';
import { SportMark } from '@/components/sport-marks';
import { SPORTS, consentAccepted, sportName, upsertConsent, type LevelId, type SportId } from '@/domain/profile';
import { traceSpeedCap } from '@/domain/trace-fix';
import { useMeetups } from '@/state/meetup-context';
import { useProfile } from '@/state/profile-context';
import { useDeviceLocation } from '@/state/use-device-location';
import { useStepCounter } from '@/state/use-step-counter';
import { formatClock, hasTrack, raceReport, segmentsLabel, segmentsLength, useTrace, type RaceReport } from '@/state/use-trace';
import { space, useColors, type Palette } from '@/theme/colors';
import { setMapBearing, useMapBearing } from '@/theme/map-style';
import { useHideTabs } from '@/ui/hide-tabs';
import { useFrame } from '@/ui/use-frame';

const EMPTY_MARKERS: [] = [];
const EMPTY_LINES: [] = [];

function dateLabel(date: Date) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - start.getTime()) / 86_400_000);
  if (diff === 0) {
    return 'Hoy';
  }
  if (diff === 1) {
    return 'Mañana';
  }
  return date.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
}

function timeLabel(date: Date) {
  return date.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
}

function sportKind(kind: string) {
  return kind === 'route' ? 'Recorrido' : 'Grupo';
}

function planHint(sportId: SportId, audience: MeetupAudience) {
  if (isRouteSport(sportId)) {
    if (audience === 'solo') {
      return 'En el mapa inicias donde estás. No se publica.';
    }
    const moving = sportId === 'cycle' ? 'velocidad' : 'ritmo';
    const tail = `El tiempo define la ${moving} de la salida.`;
    if (audience === 'private') {
      return `Después eliges el punto de encuentro. No sale en el mapa público. La llegada es opcional. ${tail}`;
    }
    return `Después eliges el punto de encuentro. La llegada es opcional. ${tail}`;
  }
  if (audience === 'public') {
    return 'Después eliges el lugar en el mapa.';
  }
  if (audience === 'private') {
    return 'Después eliges el lugar. No sale en el mapa público.';
  }
  return 'Después eliges el lugar. No se publica.';
}

function courtHint(sportId: SportId, format: MatchFormat, have: number, need: number) {
  const cap = courtCapacity(sportId, format);
  if (have >= cap) {
    return 'La cancha ya está llena.';
  }
  const missing = need === 0 ? 'no faltan' : need === 1 ? 'falta 1' : `faltan ${need}`;
  const head = sportId === 'football' ? `Fútbol ${format}. Caben ${cap}.` : `Caben ${cap}.`;
  return `${head} Van ${have}, ${missing}.`;
}

export default function EntrenoScreen() {
  const { profile, save } = useProfile();
  const { add, meetups } = useMeetups();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const frame = useFrame();
  const styles = useMemo(() => createStyles(colors, frame.gutter), [colors, frame.gutter]);
  const { point, heading, locate } = useDeviceLocation();
  const trace = useTrace();
  const steps = useStepCounter(trace.active);
  const [step, setStep] = useState<'sport' | 'zone' | 'when'>('sport');
  const [sportId, setSportId] = useState<SportId | null>(null);
  const [audience, setAudience] = useState<MeetupAudience>('public');
  const [when, setWhen] = useState(() => {
    const next = new Date();
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    return next;
  });
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [center, setCenter] = useState<LatLng>(PASTO);
  const [focus, setFocus] = useState<(LatLng & { token: number }) | null>(null);
  const [followToken, setFollowToken] = useState(0);
  const bearingMode = useMapBearing();
  const [placeName, setPlaceName] = useState('');
  const [references, setReferences] = useState<ReferencePlace[]>([]);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<null | 'start' | 'finish'>(null);
  const [draft, setDraft] = useState<LatLng | null>(null);
  const [draftName, setDraftName] = useState('');
  const [finish, setFinish] = useState<{ point: LatLng; name: string } | null>(null);
  const [distance, setDistance] = useState<RouteDistance>(10);
  const [targetMinutes, setTargetMinutes] = useState(60);
  const targetTouched = useRef(false);
  const [have, setHave] = useState(1);
  const [need, setNeed] = useState(1);
  const [role, setRole] = useState<'none' | 'portero'>('none');
  const [format, setFormat] = useState<MatchFormat>(5);
  const [summary, setSummary] = useState<RaceReport | null>(null);
  const chosenRef = useRef<LatLng | null>(null);
  const finishLock = useRef<LatLng | null>(null);
  const centerRef = useRef(center);
  const labelAbort = useRef<AbortController | null>(null);
  const editingRef = useRef(editing);
  const draftLock = useRef<LatLng | null>(null);
  editingRef.current = editing;
  centerRef.current = center;
  const savedLevel = profile.sports.find((item) => item.sportId === sportId)?.level ?? null;
  const level: LevelId | null = sportId && isRouteSport(sportId) ? null : (savedLevel ?? 'intermedio');
  useHideTabs(step !== 'sport');

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (picker) {
        setPicker(null);
        return true;
      }
      if (step === 'zone') {
        setStep('when');
        return true;
      }
      if (step === 'when') {
        setStep('sport');
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [picker, step]);

  useEffect(() => {
    let alive = true;
    locate().then((next) => {
      if (!alive || !next || chosenRef.current) {
        return;
      }
      setCenter(next);
      setFocus({ ...next, token: 1 });
      setPlaceName('Buscando el lugar…');
      refreshLabel(next, 'start');
      if (!consentAccepted(profile, 'location')) {
        save({ consents: upsertConsent(profile, 'location', true) });
      }
    });
    return () => {
      alive = false;
      labelAbort.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locate]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setHits([]);
      setSearching(false);
      setSearchNote('');
      return;
    }
    let alive = true;
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(() => {
      searchPlaces(text, centerRef.current, controller.signal)
        .then((next) => {
          if (!alive) {
            return;
          }
          setHits(next);
          setSearchNote(next.length === 0 ? 'Nada con ese nombre en Pasto.' : '');
        })
        .catch((error: unknown) => {
          if (!alive) {
            return;
          }
          setHits([]);
          const timedOut = error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError' || /abort/i.test(error.message));
          setSearchNote(timedOut ? 'La búsqueda tardó demasiado. Inténtalo otra vez.' : 'No pude buscar. Revisa la conexión.');
        })
        .finally(() => {
          if (alive) {
            setSearching(false);
          }
        });
    }, 350);
    return () => {
      alive = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (step !== 'zone') {
      trace.end();
    }
  }, [step, trace.end]);

  useEffect(() => {
    if (editing !== 'start' || !draft || !placeName || placeName === 'Buscando el lugar…') {
      return;
    }
    if (distanceKm(draft, center) > 0.05) {
      return;
    }
    if (draftLock.current && distanceKm(draftLock.current, draft) <= 0.2) {
      return;
    }
    setDraftName((current) => {
      if (!current || current === 'Buscando el lugar…' || current === 'Punto en el mapa') {
        return placeName;
      }
      return current;
    });
  }, [center, draft, editing, placeName]);

  function clearSearch() {
    labelAbort.current?.abort();
    setQuery('');
    setHits([]);
    setSearchNote('');
    setSearching(false);
  }

  function lookAt(next: LatLng) {
    setFocus({ ...next, token: Date.now() });
  }

  function refreshLabel(next: LatLng, target: 'start' | 'finish') {
    labelAbort.current?.abort();
    const controller = new AbortController();
    labelAbort.current = controller;
    describePoint(next, controller.signal)
      .then((described) => {
        if (controller.signal.aborted) {
          return;
        }
        setReferences(described.places);
        if (target === 'finish') {
          setFinish((current) => {
            if (!current || distanceKm(current.point, next) > 0.2) {
              return current;
            }
            if (finishLock.current && distanceKm(finishLock.current, next) <= 0.2) {
              return current;
            }
            return { ...current, name: described.label };
          });
          return;
        }
        setPlaceName((current) => (chosenRef.current && distanceKm(chosenRef.current, next) <= 0.2 ? current : described.label));
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
      });
  }

  function refreshDraft(next: LatLng) {
    labelAbort.current?.abort();
    const controller = new AbortController();
    labelAbort.current = controller;
    describePoint(next, controller.signal)
      .then((described) => {
        if (controller.signal.aborted) {
          return;
        }
        setReferences(described.places);
        if (draftLock.current && distanceKm(draftLock.current, next) <= 0.2) {
          return;
        }
        setDraftName(described.label);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
      });
  }

  function moveDraft(next: LatLng) {
    const locked = draftLock.current;
    if (locked && distanceKm(locked, next) <= 0.2) {
      setDraft(next);
      refreshDraft(next);
      return;
    }
    draftLock.current = null;
    setDraft(next);
    setDraftName('Buscando el lugar…');
    refreshDraft(next);
  }

  function onMapCenter(next: LatLng) {
    if (sportId && isRouteSport(sportId)) {
      if (editingRef.current) {
        moveDraft(next);
      }
      return;
    }
    setCenter(next);
    const chosen = chosenRef.current;
    if (chosen && distanceKm(chosen, next) <= 0.2) {
      return;
    }
    chosenRef.current = null;
    setPlaceName((current) => current || 'Buscando el lugar…');
    refreshLabel(next, 'start');
  }

  function chooseHit(hit: PlaceHit) {
    labelAbort.current?.abort();
    setQuery('');
    setHits([]);
    setSearchNote('');
    if (sportId && isRouteSport(sportId)) {
      if (!editingRef.current) {
        lookAt(hit.point);
        return;
      }
      draftLock.current = hit.point;
      setDraft(hit.point);
      setDraftName(hit.name);
      lookAt(hit.point);
      return;
    }
    chosenRef.current = hit.point;
    setPlaceName(hit.name);
    setCenter(hit.point);
    lookAt(hit.point);
  }

  function storeDraft() {
    if (!editing || !draft) {
      return;
    }
    const name = draftName && draftName !== 'Buscando el lugar…' ? draftName : placeNameNear(draft);
    if (editing === 'start') {
      setCenter(draft);
      setPlaceName(name);
      return;
    }
    setFinish({ point: draft, name });
  }

  function beginEdit(which: 'start' | 'finish') {
    if (editing === which) {
      return;
    }
    const startPoint = editing === 'start' && draft ? draft : center;
    const startName = editing === 'start' && draft ? draftName || placeNameNear(draft) : placeName;
    const endPoint = editing === 'finish' && draft ? draft : finish?.point;
    const endName = editing === 'finish' && draft ? draftName || placeNameNear(draft) : finish?.name ?? '';
    if (editing === 'start' && draft) {
      setCenter(startPoint);
      setPlaceName(startName);
    }
    if (editing === 'finish' && draft && endPoint) {
      setFinish({ point: endPoint, name: endName });
    }
    const point = which === 'start' ? startPoint : endPoint ?? startPoint;
    const name = which === 'start' ? startName : endName;
    draftLock.current = null;
    setEditing(which);
    setDraft(point);
    setDraftName(name);
    setQuery('');
    setHits([]);
    setSearchNote('');
    lookAt(point);
  }

  function finishEdit() {
    storeDraft();
    draftLock.current = null;
    setEditing(null);
    setDraft(null);
  }

  function clearFinish() {
    finishLock.current = null;
    draftLock.current = null;
    setFinish(null);
    if (editing === 'finish') {
      setEditing(null);
      setDraft(null);
    }
  }

  async function startTrace() {
    setSearchNote('');
    const next = await locate();
    if (!next) {
      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted' && !permission.canAskAgain) {
        await Linking.openSettings();
      }
      setSearchNote(permission.status === 'granted' ? 'El GPS no respondió. Actívalo e inténtalo otra vez.' : 'Autoriza la ubicación del teléfono.');
      return;
    }
    if (!consentAccepted(profile, 'location')) {
      save({ consents: upsertConsent(profile, 'location', true) });
    }
    setSummary(null);
    steps.reset();
    trace.start(next, sportId ? traceSpeedCap(sportId) : 8);
    setFollowToken(Date.now());
  }

  function finishRace() {
    const traced = trace.end();
    setSummary(raceReport(traced, trace.clock()));
  }

  function changeFormat(next: MatchFormat) {
    const cap = courtCapacity('football', next);
    setFormat(next);
    setHave((currentHave) => {
      const haveNext = Math.min(Math.max(1, currentHave), cap);
      setNeed((currentNeed) => {
        const needNext = Math.min(currentNeed, Math.max(0, cap - haveNext));
        if (needNext === 0) {
          setRole('none');
        }
        return needNext;
      });
      return haveNext;
    });
  }

  function changeHave(next: number) {
    if (!sportId) {
      return;
    }
    const cap = courtCapacity(sportId, format);
    const value = Math.max(1, Math.min(cap, next));
    setHave(value);
    setNeed((current) => {
      const nextNeed = Math.min(current, Math.max(0, cap - value));
      if (nextNeed === 0) {
        setRole('none');
      }
      return nextNeed;
    });
  }

  function changeNeed(next: number) {
    if (!sportId) {
      return;
    }
    const cap = courtCapacity(sportId, format);
    const value = Math.max(0, Math.min(Math.max(0, cap - have), next));
    setNeed(value);
    if (value === 0) {
      setRole('none');
    }
  }

  async function useHere() {
    setSearchNote('');
    if (sportId && isRouteSport(sportId) && (trace.active || trace.paused)) {
      setFollowToken(Date.now());
      return;
    }
    const next = await locate();
    if (next) {
      labelAbort.current?.abort();
      if (sportId && isRouteSport(sportId)) {
        if (editingRef.current) {
          draftLock.current = next;
          setDraft(next);
          setDraftName('Tu ubicación');
          lookAt(next);
        } else {
          lookAt(next);
        }
      } else {
        chosenRef.current = next;
        setPlaceName('Tu ubicación');
        setCenter(next);
        lookAt(next);
      }
      if (!consentAccepted(profile, 'location')) {
        save({ consents: upsertConsent(profile, 'location', true) });
      }
      return;
    }
    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      if (!permission.canAskAgain) {
        await Linking.openSettings();
      }
      setSearchNote('Autoriza la ubicación del teléfono.');
      return;
    }
    setSearchNote('El GPS no respondió. Actívalo e inténtalo otra vez.');
  }

  function onPick(event: DateTimePickerEvent, date?: Date) {
    const mode = picker;
    setPicker(null);
    if (event.type === 'dismissed' || !date || !mode) {
      return;
    }
    setWhen((current) => {
      const next = new Date(current);
      if (mode === 'date') {
        next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      } else {
        next.setHours(date.getHours(), date.getMinutes(), 0, 0);
      }
      return next;
    });
  }

  function openMap() {
    if (!sportId) {
      return;
    }
    setMessage('');
    if (isRouteSport(sportId) && audience !== 'solo') {
      beginEdit('start');
    }
    setStep('zone');
  }

  async function confirm() {
    if (!sportId || saving) {
      return;
    }
    const route = isRouteSport(sportId);
    const soloRoute = route && audience === 'solo';
    const cap = courtCapacity(sportId, format);
    const seats = Math.max(1, Math.min(have, cap));
    const missing = Math.max(0, Math.min(need, cap - seats));
    setMessage('');
    setSaving(true);
    const traced = trace.end();
    const started = traced[0]?.[0];
    const here = soloRoute ? (started ?? point ?? center) : center;
    const name = soloRoute ? 'Tu ubicación' : placeName && placeName !== 'Buscando el lugar…' ? placeName : placeNameNear(here);
    await add({
      id: `${Date.now()}`,
      sportId,
      level,
      whenLabel: soloRoute ? `${dateLabel(new Date())} · ${timeLabel(new Date())}` : `${dateLabel(when)} · ${timeLabel(when)}`,
      placeName: name,
      latitude: here.latitude,
      longitude: here.longitude,
      note: '',
      hostName: [profile.name, profile.lastName].filter(Boolean).join(' '),
      hostUsername: profile.username,
      createdAt: new Date().toISOString(),
      audience,
      distanceKm: route && !soloRoute && distance !== 'over' ? distance : undefined,
      distanceOver42: route && !soloRoute && distance === 'over' ? true : undefined,
      targetMinutes: route && !soloRoute ? targetMinutes : undefined,
      finish: route && !soloRoute && finish ? { name: finish.name, latitude: finish.point.latitude, longitude: finish.point.longitude } : undefined,
      path:
        segmentsLength(traced) > 0
          ? {
              distanceKm: segmentsLength(traced),
              points: traced.filter((segment) => segment.length > 1).flat(),
              ...(steps.steps !== null ? { steps: steps.steps } : {}),
            }
          : undefined,
      roster:
        !route && audience !== 'solo'
          ? {
              have: seats,
              need: missing,
              role: sportId === 'football' && role === 'portero' && missing > 0 ? 'portero' : undefined,
              format: sportId === 'football' ? format : undefined,
            }
          : undefined,
    });
    trace.clear();
    setSummary(null);
    setSaving(false);
    setMessage(
      audience === 'public'
        ? 'Quedó publicada en Salidas.'
        : audience === 'private'
          ? 'Invitación guardada. Cuando haya personas o un grupo, les llega por Mensajes.'
          : 'Salida guardada. No se publica.',
    );
    setStep('sport');
  }

  const inRace = trace.active || trace.paused;
  const liveReport = inRace ? raceReport(trace.segments, trace.elapsedMs) : null;
  const routePlan = sportId !== null && isRouteSport(sportId) && audience !== 'solo';
  const zoneMarkers = useMemo(() => {
    if (!routePlan) {
      return EMPTY_MARKERS;
    }
    const start = editing === 'start' ? [] : [{ id: 'start', latitude: center.latitude, longitude: center.longitude, color: '#2457D6' }];
    const arrival = finish && editing !== 'finish' ? [{ id: 'finish', latitude: finish.point.latitude, longitude: finish.point.longitude, color: '#E07A2F' }] : [];
    return [...start, ...arrival];
  }, [routePlan, editing, center, finish]);
  const zoneLines = useMemo(() => {
    if (!inRace) {
      return EMPTY_LINES;
    }
    return trace.segments.flatMap((segment) =>
      segment.length > 1 ? [{ from: segment[0], to: segment[segment.length - 1], points: segment }] : [],
    );
  }, [inRace, trace.segments]);

  useEffect(() => {
    if (!inRace) {
      setFollowToken(0);
    }
  }, [inRace]);

  return (
    <View style={styles.frame}>
      <FadeSwap pageKey={step} style={styles.swap}>
        {step === 'sport' ? (
          <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
            <ScrollView contentContainerStyle={[styles.sportList, frame.wide ? styles.narrow : null]} keyboardShouldPersistTaps="handled">
              <Text style={styles.kicker}>Paso 1 de 3</Text>
              <Text style={styles.title}>Entreno</Text>
              <Text style={styles.subtitle}>Elige el deporte. Después la fecha y el mapa.</Text>
              {SPORTS.map((sport) => {
                const selected = sport.id === sportId;
                return (
                  <Pressable
                    key={sport.id}
                    accessibilityRole="button"
                    onPress={() => {
                      setSportId(sport.id);
                      targetTouched.current = false;
                      if (sport.kind === 'route') {
                        setTargetMinutes(defaultTargetMinutes(sport.id, distance));
                      }
                      setEditing(null);
                      setDraft(null);
                      trace.clear();
                      setSummary(null);
                      setFinish(null);
                      setHave(1);
                      setNeed(1);
                      setRole('none');
                      setFormat(5);
                      setMessage('');
                      setStep('when');
                    }}
                    style={[styles.sportCard, selected ? styles.sportCardOn : null]}>
                    <SportMark sport={sport.id} size={32} />
                    <View style={styles.sportCopy}>
                      <Text style={styles.sportName}>{sport.name}</Text>
                      <Text style={styles.sportKind}>{sportKind(sport.kind)}</Text>
                    </View>
                  </Pressable>
                );
              })}
              {message ? <Text style={styles.message}>{message}</Text> : null}
            </ScrollView>
          </SafeAreaView>
        ) : null}
        {step === 'zone' && sportId ? (
          <View style={styles.zone}>
            <CityMap
              markers={zoneMarkers}
              lines={zoneLines}
              places={references.map((place) => ({ name: place.name, latitude: place.point.latitude, longitude: place.point.longitude }))}
              me={isRouteSport(sportId) && trace.live ? trace.live : point}
              heading={heading}
              focus={focus}
              followToken={followToken}
              bearingMode={bearingMode}
              onUserMove={() => setFollowToken(0)}
              rounded={false}
              showCenterPin={!isRouteSport(sportId) || (routePlan && editing !== null)}
              centerColor={editing === 'finish' ? '#E07A2F' : '#2457D6'}
              onCenter={!isRouteSport(sportId) || (routePlan && editing !== null) ? onMapCenter : undefined}
            />
            <View style={[styles.searchWrap, { top: insets.top + 8 }]} pointerEvents="box-none">
              <View style={styles.searchRow}>
                <Pressable accessibilityRole="button" accessibilityLabel="Atrás" onPress={() => setStep('when')} style={styles.back}>
                  <Text style={styles.backLabel}>Atrás</Text>
                </Pressable>
                {isRouteSport(sportId) && !routePlan ? null : (
                  <View style={styles.searchField}>
                    <TextInput
                      value={query}
                      onChangeText={setQuery}
                      placeholder={isRouteSport(sportId) ? (editing === 'finish' ? 'Buscar la llegada' : editing === 'start' ? 'Buscar la salida' : 'Ver un lugar') : 'Buscar la cancha'}
                      placeholderTextColor={colors.placeholder}
                      style={[styles.search, query ? styles.searchWithClear : null]}
                      autoCorrect={false}
                      autoCapitalize="words"
                    />
                    {query ? (
                      <Pressable accessibilityRole="button" accessibilityLabel="Borrar búsqueda" onPress={clearSearch} style={styles.clearSearch}>
                        <Text style={styles.clearSearchLabel}>×</Text>
                      </Pressable>
                    ) : null}
                  </View>
                )}
              </View>
              {isRouteSport(sportId) && !routePlan ? (
                searchNote ? (
                  <View style={styles.results}>
                    <Text style={styles.noteLine}>{searchNote}</Text>
                  </View>
                ) : null
              ) : searching || searchNote || hits.length > 0 ? (
                <View style={styles.results}>
                  {searching ? <Text style={styles.noteLine}>Buscando…</Text> : null}
                  {searchNote ? <Text style={styles.noteLine}>{searchNote}</Text> : null}
                  {hits.map((hit) => (
                    <Pressable key={hit.id} accessibilityRole="button" onPress={() => chooseHit(hit)} style={styles.result}>
                      <Text style={styles.resultName}>{hit.name}</Text>
                      <Text style={styles.resultMeta}>{hit.detail}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={followToken > 0 ? 'Siguiendo tu ubicación' : 'Centrar y seguir'}
              onPress={useHere}
              style={[styles.locate, isRouteSport(sportId) ? (routePlan || inRace || summary ? styles.locateRoute : styles.locateSolo) : null, { bottom: (isRouteSport(sportId) ? (routePlan || inRace || summary ? 320 : 188) : 108) + insets.bottom, backgroundColor: colors.card, borderColor: colors.line }]}>
              <View style={[styles.locateRing, { borderColor: colors.action }]} />
              <View style={[styles.locateDot, followToken > 0 ? styles.locateDotOn : null, { backgroundColor: colors.action }]} />
            </Pressable>
            {inRace ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={bearingMode === 'heading' ? 'Dejar el mapa al norte' : 'Girar el mapa con tu rumbo'}
                onPress={() => {
                  const next = bearingMode === 'heading' ? 'north' : 'heading';
                  setMapBearing(next);
                  if (followToken <= 0) setFollowToken(Date.now());
                }}
                style={[styles.compass, { bottom: 376 + insets.bottom, backgroundColor: colors.card, borderColor: bearingMode === 'heading' ? colors.action : colors.line }]}>
                <View style={{ transform: [{ rotate: bearingMode === 'heading' && heading != null ? `${-heading}deg` : '0deg' }] }}>
                  <Text style={[styles.compassLabel, { color: bearingMode === 'heading' ? colors.action : colors.ink }]}>N</Text>
                </View>
              </Pressable>
            ) : null}
            <View style={[styles.zoneDock, { bottom: 12 + insets.bottom }]}>
              {isRouteSport(sportId) ? (
                summary ? (
                  <>
                    <Text style={styles.raceKicker}>Resumen</Text>
                    <Text style={styles.raceTime}>{formatClock(summary.elapsedMs)}</Text>
                    <Text style={styles.pointNote}>
                      {summary.distanceKm < 0.05 ? '0 m' : formatDistance(summary.distanceKm)}
                      {summary.distanceKm >= 0.2 ? ` · ritmo medio ${formatClock(summary.elapsedMs / summary.distanceKm)} / km` : ''}
                    </Text>
                    <ScrollView style={styles.splitList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                      {summary.splits.map((split) => (
                        <Text key={split.km} style={styles.splitLine}>
                          Km {split.km} · {formatClock(split.seconds * 1000)}
                        </Text>
                      ))}
                      {summary.remainderKm >= 0.05 ? (
                        <Text style={styles.splitLine}>
                          {formatDistance(summary.remainderKm)} · {formatClock(summary.remainderMs)}
                        </Text>
                      ) : null}
                      {summary.splits.length === 0 && summary.remainderKm < 0.05 ? (
                        <Text style={styles.splitLine}>Sin un kilómetro completo.</Text>
                      ) : null}
                    </ScrollView>
                  </>
                ) : inRace && liveReport ? (
                  <>
                    <Text style={styles.raceTime}>{formatClock(trace.elapsedMs)}</Text>
                    <Text style={styles.pointNote}>
                      {trace.paused ? 'En pausa · ' : ''}
                      {segmentsLabel(trace.segments)} · Km {liveReport.splits.length + 1} · {formatClock(liveReport.remainderMs)}
                    </Text>
                    <View style={styles.raceActions}>
                      <Button
                        size="compact"
                        style={styles.raceAction}
                        label={trace.paused ? 'Reanudar carrera' : 'Pausar carrera'}
                        onPress={trace.paused ? trace.resume : trace.pause}
                      />
                      <Button size="compact" variant="quiet" style={styles.raceAction} label="Terminar carrera" onPress={finishRace} />
                    </View>
                  </>
                ) : routePlan ? (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: editing === 'start' }}
                      onPress={() => beginEdit('start')}
                      style={[styles.pointRow, editing === 'start' ? styles.pointRowOn : null]}>
                      <View style={[styles.pointDot, { backgroundColor: '#2457D6' }]} />
                      <View style={styles.pointCopy}>
                        <Text style={styles.pointHint}>Salida</Text>
                        <Text style={styles.pointName} numberOfLines={1}>
                          {(editing === 'start' ? draftName : placeName) || 'Tu salida'}
                        </Text>
                      </View>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: editing === 'finish' }}
                      onPress={() => beginEdit('finish')}
                      style={[styles.pointRow, editing === 'finish' ? styles.pointRowOn : null]}>
                      <View style={[styles.pointDot, { backgroundColor: '#E07A2F' }]} />
                      <View style={styles.pointCopy}>
                        <Text style={styles.pointHint}>Llegada</Text>
                        <Text style={[styles.pointName, finish || editing === 'finish' ? null : styles.pointOptional]} numberOfLines={1}>
                          {editing === 'finish' ? draftName || 'Mueve el mapa' : finish ? finish.name : 'Toca para elegirla'}
                        </Text>
                      </View>
                      {finish ? (
                        <Pressable accessibilityRole="button" onPress={clearFinish} hitSlop={8} style={styles.clearFinish}>
                          <Text style={styles.clearFinishLabel}>Quitar</Text>
                        </Pressable>
                      ) : null}
                    </Pressable>
                    <Text style={styles.pointNote}>
                      {editing
                        ? 'Mueve el mapa y confirma con Listo.'
                        : hasTrack(trace.segments)
                          ? `${segmentsLabel(trace.segments)} recorridos`
                          : 'Toca Salida o Llegada para mover un punto. Al iniciar, el mapa dibuja por donde vas.'}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.pointNote}>
                    {hasTrack(trace.segments) ? `${segmentsLabel(trace.segments)} recorridos` : 'Inicias donde estás. El mapa dibuja por donde vas.'}
                  </Text>
                )
              ) : (
                <Text style={styles.place}>{placeName || 'Mueve el mapa o busca la cancha'}</Text>
              )}
              {editing ? (
                <Button size="compact" label="Listo" onPress={finishEdit} />
              ) : inRace ? null : (
                <>
                  {isRouteSport(sportId) && !summary ? (
                    <Button size="compact" label={hasTrack(trace.segments) ? 'Iniciar de nuevo' : 'Iniciar'} onPress={startTrace} />
                  ) : null}
                  {isRouteSport(sportId) && !routePlan && !summary ? null : (
                    <Button
                      size="compact"
                      variant={isRouteSport(sportId) && !summary ? 'quiet' : 'primary'}
                      label={audience === 'public' ? 'Publicar en Salidas' : audience === 'private' ? 'Guardar invitación' : 'Guardar salida'}
                      onPress={confirm}
                      disabled={saving}
                    />
                  )}
                </>
              )}
            </View>
          </View>
        ) : null}
        {step === 'when' && sportId ? (
          <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
            <ScrollView style={styles.swap} contentContainerStyle={[styles.whenPage, { paddingBottom: Math.max(insets.bottom, 16) + 24 }, frame.wide ? styles.narrow : null]} keyboardShouldPersistTaps="handled">
              <Pressable accessibilityRole="button" onPress={() => setStep('sport')} style={styles.backInline}>
                <Text style={styles.backLabel}>Atrás</Text>
              </Pressable>
              <Text style={styles.kicker}>Paso 2 de 3</Text>
              <Text style={styles.title}>{isRouteSport(sportId) && audience === 'solo' ? 'Metas' : 'Fecha'}</Text>
              <Text style={styles.summary}>{sportName(sportId)}</Text>
              <Segment
                value={audience}
                options={[
                  { id: 'public', label: 'Pública' },
                  { id: 'private', label: 'Privada' },
                  { id: 'solo', label: 'Solo' },
                ]}
                onChange={(id) => {
                  const next = id as MeetupAudience;
                  setAudience(next);
                  if (next === 'solo' && isRouteSport(sportId)) {
                    setEditing(null);
                    setDraft(null);
                    draftLock.current = null;
                    finishLock.current = null;
                    setFinish(null);
                  }
                }}
              />
              {routePlan ? (
                <>
                  <DistanceWheel
                    value={distance}
                    onChange={(next) => {
                      setDistance(next);
                      if (!targetTouched.current) {
                        setTargetMinutes(defaultTargetMinutes(sportId, next));
                      }
                    }}
                  />
                  <Text style={styles.countLabel}>Tiempo de la carrera</Text>
                  <Count
                    label="Horas"
                    value={Math.floor(targetMinutes / 60)}
                    min={0}
                    max={Math.floor(TARGET_MAX_MINUTES / 60)}
                    onChange={(hours) => {
                      targetTouched.current = true;
                      const mins = targetMinutes % 60;
                      const next = Math.min(TARGET_MAX_MINUTES, Math.max(TARGET_MIN_MINUTES, hours * 60 + mins));
                      setTargetMinutes(next);
                    }}
                    styles={styles}
                  />
                  <Count
                    label="Minutos"
                    value={targetMinutes % 60}
                    min={Math.floor(targetMinutes / 60) === 0 ? TARGET_MIN_MINUTES : 0}
                    max={Math.floor(targetMinutes / 60) >= 12 ? 0 : 55}
                    step={5}
                    onChange={(mins) => {
                      targetTouched.current = true;
                      const hours = Math.floor(targetMinutes / 60);
                      const next = Math.min(TARGET_MAX_MINUTES, Math.max(TARGET_MIN_MINUTES, hours * 60 + mins));
                      setTargetMinutes(next);
                    }}
                    styles={styles}
                  />
                  <View style={styles.goal}>
                    <Text style={styles.goalTitle}>{effortPaceLine(sportId, distance, targetMinutes)}</Text>
                    <Text style={styles.goalDetail}>
                      {distance === 'over' ? 'Quienes vean la salida verán ese tiempo.' : 'Así se publica en la salida.'}
                    </Text>
                  </View>
                </>
              ) : null}
              {!isRouteSport(sportId) && audience !== 'solo' ? (
                <View style={styles.roster}>
                  {sportId === 'football' ? (
                    <Segment
                      value={String(format)}
                      options={[
                        { id: '5', label: 'Fútbol 5' },
                        { id: '7', label: 'Fútbol 7' },
                        { id: '11', label: 'Fútbol 11' },
                      ]}
                      onChange={(id) => changeFormat(id === '11' ? 11 : id === '7' ? 7 : 5)}
                    />
                  ) : null}
                  <Count label="Somos" value={have} min={1} max={courtCapacity(sportId, format)} onChange={changeHave} styles={styles} />
                  <Count
                    label="Faltan"
                    value={need}
                    min={0}
                    max={Math.max(0, courtCapacity(sportId, format) - have)}
                    onChange={changeNeed}
                    styles={styles}
                  />
                  {sportId === 'football' && need > 0 ? (
                    <Segment
                      value={role}
                      options={[
                        { id: 'none', label: 'Sin puesto' },
                        { id: 'portero', label: 'Portero' },
                      ]}
                      onChange={(id) => setRole(id === 'portero' ? 'portero' : 'none')}
                    />
                  ) : null}
                  <Text style={styles.hint}>{courtHint(sportId, format, have, need)}</Text>
                </View>
              ) : null}
              {isRouteSport(sportId) && audience === 'solo' ? (
                <View style={styles.goals}>
                  {routeGoals(meetups, sportId).map((goal) => (
                    <View key={goal.id} style={styles.goal}>
                      <Text style={styles.goalTitle}>{goal.title}</Text>
                      <Text style={styles.goalDetail}>{goal.detail}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.whenRow}>
                  <Pressable accessibilityRole="button" onPress={() => setPicker('date')} style={styles.whenField}>
                    <Text style={styles.whenHint}>Fecha</Text>
                    <Text style={styles.whenValue}>{dateLabel(when)}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => setPicker('time')} style={styles.whenField}>
                    <Text style={styles.whenHint}>Hora</Text>
                    <Text style={styles.whenValue}>{timeLabel(when)}</Text>
                  </Pressable>
                </View>
              )}
              <Text style={styles.hint}>{planHint(sportId, audience)}</Text>
              <Button label={isRouteSport(sportId) && audience === 'solo' ? 'Ir al mapa' : 'Elegir en el mapa'} onPress={openMap} />
              {message ? <Text style={styles.message}>{message}</Text> : null}
            </ScrollView>
          </SafeAreaView>
        ) : null}
      </FadeSwap>
      {picker ? (
        <DateTimePicker value={when} mode={picker} minimumDate={picker === 'date' ? new Date() : undefined} is24Hour={false} onChange={onPick} />
      ) : null}
    </View>
  );
}

function Count({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  styles,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const down = value - step >= min;
  const up = value + step <= max;
  return (
    <View style={styles.count}>
      <Text style={styles.countLabel}>{label}</Text>
      <View style={styles.countRow}>
        <Pressable
          accessibilityRole="button"
          disabled={!down}
          onPress={() => onChange(value - step)}
          style={[styles.countButton, down ? null : styles.countOff]}>
          <Text style={styles.countValue}>−</Text>
        </Pressable>
        <Text style={styles.countValue}>{value}</Text>
        <Pressable
          accessibilityRole="button"
          disabled={!up}
          onPress={() => onChange(value + step)}
          style={[styles.countButton, up ? null : styles.countOff]}>
          <Text style={styles.countValue}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: Palette, gutter: number) {
  return StyleSheet.create({
    frame: {
      flex: 1,
      backgroundColor: colors.paper,
    },
    swap: {
      flex: 1,
    },
    safe: {
      flex: 1,
      backgroundColor: colors.paper,
    },
    narrow: {
      width: '100%',
      maxWidth: 640,
      alignSelf: 'center',
    },
    sportList: {
      paddingHorizontal: gutter,
      paddingTop: space.sm,
      paddingBottom: space.xl,
      gap: 10,
    },
    kicker: {
      color: colors.action,
      fontSize: 13,
      fontWeight: '600',
    },
    title: {
      color: colors.ink,
      fontSize: 32,
      lineHeight: 38,
      fontWeight: '700',
    },
    subtitle: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 21,
      marginBottom: 6,
    },
    sportCard: {
      minHeight: 72,
      borderRadius: 20,
      backgroundColor: colors.card,
      paddingHorizontal: 16,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    sportCopy: {
      flex: 1,
      gap: 2,
    },
    sportCardOn: {
      borderWidth: 1.5,
      borderColor: colors.action,
    },
    sportName: {
      color: colors.ink,
      fontSize: 18,
      fontWeight: '700',
    },
    sportKind: {
      color: colors.muted,
      fontSize: 14,
    },
    message: {
      color: colors.action,
      fontSize: 15,
      lineHeight: 21,
      marginTop: 4,
    },
    zone: {
      flex: 1,
    },
    searchWrap: {
      position: 'absolute',
      left: 12,
      right: 12,
      gap: 8,
      zIndex: 20,
      elevation: 20,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    back: {
      height: 44,
      paddingHorizontal: 14,
      borderRadius: 22,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backInline: {
      alignSelf: 'flex-start',
      minHeight: 36,
      justifyContent: 'center',
    },
    backLabel: {
      color: colors.ink,
      fontSize: 15,
      fontWeight: '600',
    },
    searchField: {
      flex: 1,
      height: 44,
      justifyContent: 'center',
    },
    search: {
      height: 44,
      borderRadius: 22,
      paddingHorizontal: 16,
      backgroundColor: colors.card,
      color: colors.ink,
      fontSize: 15,
    },
    searchWithClear: {
      paddingRight: 40,
    },
    clearSearch: {
      position: 'absolute',
      right: 6,
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    clearSearchLabel: {
      color: colors.muted,
      fontSize: 22,
      lineHeight: 24,
      fontWeight: '500',
    },
    results: {
      borderRadius: 18,
      backgroundColor: colors.card,
      overflow: 'hidden',
    },
    result: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 2,
    },
    resultName: {
      color: colors.ink,
      fontSize: 15,
      fontWeight: '700',
    },
    resultMeta: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 18,
    },
    noteLine: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 18,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    locate: {
      position: 'absolute',
      right: 12,
      bottom: 108,
      zIndex: 20,
      elevation: 20,
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    locateRoute: {
      bottom: 320,
    },
    locateSolo: {
      bottom: 188,
    },
    locateRing: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
    },
    locateDot: {
      position: 'absolute',
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    locateDotOn: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    compass: {
      position: 'absolute',
      right: 12,
      bottom: 376,
      zIndex: 20,
      elevation: 20,
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    compassLabel: {
      fontSize: 16,
      fontWeight: '700',
    },
    zoneDock: {
      position: 'absolute',
      left: 12,
      right: 12,
      bottom: 12,
      zIndex: 20,
      elevation: 20,
      gap: 8,
      borderRadius: 20,
      backgroundColor: colors.card,
      padding: 12,
    },
    raceKicker: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
      letterSpacing: 0.4,
    },
    raceTime: {
      color: colors.ink,
      fontSize: 40,
      lineHeight: 46,
      fontWeight: '700',
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    raceActions: {
      flexDirection: 'row',
      gap: 8,
    },
    raceAction: {
      flex: 1,
    },
    splitList: {
      maxHeight: 168,
    },
    splitLine: {
      color: colors.ink,
      fontSize: 15,
      lineHeight: 24,
      fontVariant: ['tabular-nums'],
    },
    place: {
      color: colors.ink,
      fontSize: 15,
      fontWeight: '600',
    },
    pointRow: {
      minHeight: 52,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    pointRowOn: {
      borderColor: colors.action,
    },
    pointDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    pointCopy: {
      flex: 1,
      gap: 1,
    },
    pointHint: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: '600',
    },
    pointName: {
      color: colors.ink,
      fontSize: 15,
      fontWeight: '700',
    },
    pointOptional: {
      color: colors.muted,
      fontWeight: '500',
    },
    pointNote: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 18,
    },
    whenPage: {
      paddingHorizontal: gutter,
      paddingTop: space.sm,
      gap: 12,
    },
    summary: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 21,
    },
    whenRow: {
      flexDirection: 'row',
      gap: 8,
    },
    goals: {
      gap: 8,
    },
    goal: {
      borderRadius: 16,
      backgroundColor: colors.card,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 2,
    },
    goalTitle: {
      color: colors.ink,
      fontSize: 17,
      fontWeight: '700',
    },
    goalDetail: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
    },
    whenField: {
      flex: 1,
      minHeight: 64,
      borderRadius: 16,
      backgroundColor: colors.card,
      paddingHorizontal: 14,
      justifyContent: 'center',
    },
    whenHint: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: '500',
    },
    whenValue: {
      color: colors.ink,
      fontSize: 17,
      fontWeight: '700',
    },
    roster: {
      gap: 10,
    },
    count: {
      minHeight: 52,
      borderRadius: 16,
      backgroundColor: colors.card,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    countLabel: {
      color: colors.ink,
      fontSize: 16,
      fontWeight: '700',
    },
    countRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    countButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.paper,
      alignItems: 'center',
      justifyContent: 'center',
    },
    countValue: {
      color: colors.ink,
      fontSize: 18,
      fontWeight: '700',
      minWidth: 24,
      textAlign: 'center',
    },
    countOff: {
      opacity: 0.35,
    },
    clearFinish: {
      alignSelf: 'flex-start',
      minHeight: 32,
      justifyContent: 'center',
    },
    clearFinishLabel: {
      color: colors.action,
      fontSize: 14,
      fontWeight: '600',
    },
    hint: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
    },
  });
}
