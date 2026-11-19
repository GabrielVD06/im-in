import { useEffect, useMemo, useRef, useState, type ReactElement, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import type { LatLng } from '@/domain/geo';
import type { SportId } from '@/domain/profile';
import { SPORT_WHITE } from '@/components/sport-icon-white';
import { SPORT_COLOR } from '@/components/sport-marks';
import { useMapStyle, type MapBearing, type MapStyleId } from '@/theme/map-style';

type MapHandle = { injectJavaScript: (script: string) => void };

const MapWeb = WebView as unknown as (props: {
  ref?: Ref<MapHandle>;
  originWhitelist?: string[];
  source?: { html: string; baseUrl?: string };
  onMessage?: (event: { nativeEvent: { data: string } }) => void;
  javaScriptEnabled?: boolean;
  domStorageEnabled?: boolean;
  setSupportMultipleWindows?: boolean;
  scrollEnabled?: boolean;
  nestedScrollEnabled?: boolean;
  androidLayerType?: 'none' | 'software' | 'hardware';
  userAgent?: string;
  style?: object;
}) => ReactElement;

export type MapMarker = LatLng & { id: string; color?: string; sport?: SportId };
export type MapLine = { from: LatLng; to: LatLng; points?: LatLng[] };
export type MapPlace = { name: string; latitude: number; longitude: number };

type CityMapProps = {
  markers: MapMarker[];
  lines?: MapLine[];
  places?: MapPlace[];
  me?: LatLng | null;
  heading?: number | null;
  focus?: (LatLng & { token: number }) | null;
  followToken?: number;
  bearingMode?: MapBearing;
  onUserMove?: () => void;
  showCenterPin?: boolean;
  centerColor?: string;
  rounded?: boolean;
  onCenter?: (point: LatLng) => void;
  onSelect?: (id: string) => void;
};

const MAP_LIB = 'https://unpkg.com/maplibre-gl@5.6.1/dist';

function mapHtml(styleId: MapStyleId) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link href="${MAP_LIB}/maplibre-gl.css" rel="stylesheet" />
<style>
  html, body, #map { height: 100%; margin: 0; background: #E4DDD4; }
  .maplibregl-ctrl-bottom-right { bottom: 96px; right: 8px; }
  .maplibregl-ctrl-attrib { font-size: 10px; background: rgba(255,252,248,0.88); }
  #north { position: absolute; left: 12px; top: 96px; z-index: 2; width: 40px; height: 40px; border-radius: 20px; border: 1px solid rgba(22,22,22,0.12); background: #FFFCF8; color: #161616; font: 700 13px sans-serif; display: none; align-items: center; justify-content: center; }
</style>
</head>
<body>
<div id="map"></div>
<button id="north" type="button">N</button>
<script src="${MAP_LIB}/maplibre-gl-csp.js"></script>
<script>
const sportColor = ${JSON.stringify(SPORT_COLOR)};
const sportWhite = ${JSON.stringify(SPORT_WHITE)};
  maplibregl.setWorkerUrl('${MAP_LIB}/maplibre-gl-csp-worker.js');
  const STYLES = {
    positron: 'https://tiles.openfreemap.org/styles/positron',
    bright: 'https://tiles.openfreemap.org/styles/bright',
    dark: 'https://tiles.openfreemap.org/styles/dark',
    fiord: 'https://tiles.openfreemap.org/styles/fiord'
  };
  let styleId = ${JSON.stringify(styleId)};
  let markers = [];
  let lines = [];
  let places = [];
  let me = null;
  let compassMode = 'north';
  let followId = 0;
  let cancelledFollow = 0;
  let followZoomToken = 0;
  let targetHeading = 0;
  let shownHeading = 0;
  let hasHeading = false;
  let targetMe = null;
  let shownMe = null;
  let driven = false;
  const HEADING_TAU = 130;
  const POSITION_TAU = 480;
  const markerRadius = ['interpolate', ['linear'], ['zoom'], 12, 2, 14, 3, 16, 7, 18, 11, 20, 15];
  const markerStroke = ['interpolate', ['linear'], ['zoom'], 12, 1, 16, 1.5, 18, 2.5];
  const sportSize = ['interpolate', ['linear'], ['zoom'], 12, 0.42, 14, 0.62, 16, 0.78, 18, 0.92, 20, 1.05];
  const puckSize = ['interpolate', ['linear'], ['zoom'], 12, 0.2, 14, 0.28, 16, 0.46, 18, 0.72, 20, 0.96];
  const empty = { type: 'FeatureCollection', features: [] };
  const map = new maplibregl.Map({
    container: 'map',
    style: STYLES[styleId],
    center: [-77.27829, 1.21461],
    zoom: 14,
    attributionControl: { compact: true },
    fadeDuration: 0
  });
  map.touchZoomRotate.enable();
  map.dragPan.enable();
  map.touchPitch.disable();
  const northButton = document.getElementById('north');
  function syncNorth() {
    northButton.style.display = compassMode === 'north' && Math.abs(map.getBearing()) > 4 ? 'flex' : 'none';
  }
  map.on('rotate', syncNorth);
  northButton.addEventListener('click', function () {
    map.easeTo({ bearing: 0 });
  });
  function userMoved(event) {
    if (!event.originalEvent || followId === 0) return;
    cancelledFollow = followId;
    followId = 0;
    map.stop();
    syncNorth();
    send({ type: 'gesture' });
  }
  map.on('dragstart', userMoved);
  function shortest(from, to) {
    return ((to - from + 540) % 360) - 180;
  }
  function damp(current, target, dt, tau) {
    return current + (target - current) * (1 - Math.exp(-dt / tau));
  }
  function dampAngle(current, target, dt, tau) {
    return (current + shortest(current, target) * (1 - Math.exp(-dt / tau)) + 360) % 360;
  }
  function gapKm(from, to) {
    const north = (from.latitude - to.latitude) * 110.574;
    const east = (from.longitude - to.longitude) * 111.32 * Math.cos((from.latitude * Math.PI) / 180);
    return Math.hypot(north, east);
  }
  function aimHeading(next) {
    targetHeading = next;
    if (!hasHeading) {
      shownHeading = next;
      hasHeading = true;
    }
  }
  function aimMe(next) {
    targetMe = next;
    if (!next) {
      shownMe = null;
      return;
    }
    if (!shownMe || gapKm(shownMe, next) > 0.2) {
      shownMe = { latitude: next.latitude, longitude: next.longitude };
    }
  }
  function drawPuck() {
    const source = map.getSource('salida-me');
    if (!source) return;
    source.setData(shownMe ? pointFeature(shownMe.longitude, shownMe.latitude, 'me', '#1C8C4A', shownHeading) : empty);
  }
  function cameraDrift() {
    if (followId === 0 || !shownMe) return false;
    const center = map.getCenter();
    const bearingTarget = compassMode === 'heading' ? shownHeading : 0;
    return Math.abs(center.lat - shownMe.latitude) > 0.000008
      || Math.abs(center.lng - shownMe.longitude) > 0.000008
      || Math.abs(shortest(map.getBearing(), bearingTarget)) > 0.35;
  }
  let lastFrame = 0;
  function play(now) {
    requestAnimationFrame(play);
    const dt = lastFrame ? Math.min(40, now - lastFrame) : 16;
    lastFrame = now;
    const beforeHeading = shownHeading;
    const beforeLatitude = shownMe ? shownMe.latitude : null;
    const beforeLongitude = shownMe ? shownMe.longitude : null;
    if (hasHeading) shownHeading = dampAngle(shownHeading, targetHeading, dt, HEADING_TAU);
    if (targetMe && shownMe && gapKm(shownMe, targetMe) > 0.001) {
      shownMe = {
        latitude: damp(shownMe.latitude, targetMe.latitude, dt, POSITION_TAU),
        longitude: damp(shownMe.longitude, targetMe.longitude, dt, POSITION_TAU)
      };
    }
    const headingMoved = Math.abs(shortest(beforeHeading, shownHeading)) > 0.05;
    const positionMoved = Boolean(shownMe) && (beforeLatitude !== shownMe.latitude || beforeLongitude !== shownMe.longitude);
    if ((headingMoved || positionMoved) && map.isStyleLoaded()) drawPuck();
    if (cameraDrift()) {
      driven = true;
      map.jumpTo({
        center: [shownMe.longitude, shownMe.latitude],
        bearing: compassMode === 'heading' ? shownHeading : 0
      });
      syncNorth();
    }
  }
  requestAnimationFrame(play);
  function pointFeature(longitude, latitude, id, color, bearing, sport) {
    return {
      type: 'Feature',
      properties: { id: id || '', color: color || '#2457D6', heading: typeof bearing === 'number' ? bearing : 0, sport: sport || '' },
      geometry: { type: 'Point', coordinates: [longitude, latitude] }
    };
  }
  function puckImage() {
    const canvas = document.createElement('canvas');
    canvas.width = 192;
    canvas.height = 192;
    const pen = canvas.getContext('2d');
    pen.clearRect(0, 0, 192, 192);
    pen.lineJoin = 'round';
    pen.lineCap = 'round';
    pen.beginPath();
    pen.arc(96, 96, 28, 0, Math.PI * 2);
    pen.lineWidth = 5;
    pen.strokeStyle = 'rgba(28, 140, 74, 0.85)';
    pen.stroke();
    pen.beginPath();
    pen.moveTo(96, 28);
    pen.lineTo(122, 62);
    pen.lineTo(96, 56);
    pen.lineTo(70, 62);
    pen.closePath();
    pen.fillStyle = '#1C8C4A';
    pen.strokeStyle = '#FFFCF8';
    pen.lineWidth = 5;
    pen.fill();
    pen.stroke();
    pen.beginPath();
    pen.arc(96, 96, 13, 0, Math.PI * 2);
    pen.fillStyle = '#1C8C4A';
    pen.fill();
    pen.lineWidth = 5;
    pen.strokeStyle = '#FFFCF8';
    pen.stroke();
    pen.beginPath();
    pen.arc(96, 96, 4, 0, Math.PI * 2);
    pen.fillStyle = '#FFFCF8';
    pen.fill();
    return pen.getImageData(0, 0, 192, 192);
  }
  function mountSport(kind) {
    const name = 'salida-sport-' + kind;
    if (map.hasImage(name) || !sportWhite[kind]) return;
    const img = new Image();
    img.onload = function () {
      if (map.hasImage(name)) return;
      const size = 144;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const pen = canvas.getContext('2d');
      pen.clearRect(0, 0, size, size);
      pen.beginPath();
      pen.arc(72, 72, 64, 0, Math.PI * 2);
      pen.fillStyle = sportColor[kind] || '#2457D6';
      pen.fill();
      pen.lineWidth = 6;
      pen.strokeStyle = '#FFFCF8';
      pen.stroke();
      const glyph = 92;
      pen.drawImage(img, (size - glyph) / 2, (size - glyph) / 2, glyph, glyph);
      map.addImage(name, pen.getImageData(0, 0, size, size), { pixelRatio: 3 });
    };
    img.src = sportWhite[kind];
  }
  function lineFeature(item) {
    const coordinates = item.points && item.points.length > 1
      ? item.points.map(function (point) { return [point.longitude, point.latitude]; })
      : [[item.from.longitude, item.from.latitude], [item.to.longitude, item.to.latitude]];
    return {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coordinates }
    };
  }
  function mountPlaces() {
    if (map.getLayer('salida-places') || !map.getSource('openmaptiles')) return;
    const dark = styleId === 'dark' || styleId === 'fiord';
    const before = map.getLayer('salida-markers') ? 'salida-markers' : undefined;
    try {
      map.addLayer({
        id: 'salida-places',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'poi',
        minzoom: 18,
        filter: ['all',
          ['match', ['geometry-type'], ['Point', 'MultiPoint'], true, false],
          ['has', 'name'],
          ['!', ['match', ['get', 'class'],
            ['bench', 'waste_basket', 'toilets', 'post_box', 'telephone', 'drinking_water', 'recycling', 'camera', 'surveillance', 'traffic_signals', 'elevator', 'entrance', 'gate', 'street_lamp', 'parking', 'bicycle_parking', 'information', 'guidepost'],
            true, false]]
        ],
        layout: {
          'text-field': ['coalesce', ['get', 'name'], ['get', 'name_en'], ['get', 'name:latin']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 12,
          'text-max-width': 8,
          'text-anchor': 'top',
          'text-offset': [0, 0.2],
          'text-optional': true,
          'text-padding': 6
        },
        paint: {
          'text-color': dark ? '#F4F1EA' : '#2C2C2C',
          'text-halo-color': dark ? '#141414' : '#FFFCF8',
          'text-halo-width': 1.4
        }
      }, before);
    } catch (error) {
      // A style without that source still shows the streets.
    }
  }
  function overlays() {
    mountPlaces();
    if (!map.hasImage('salida-puck')) {
      map.addImage('salida-puck', puckImage(), { pixelRatio: 2 });
    }
    ['run', 'cycle', 'football', 'basketball', 'padel'].forEach(mountSport);
    if (!map.getSource('salida-me')) {
      map.addSource('salida-me', { type: 'geojson', data: empty });
    }
    if (!map.getSource('salida-route')) {
      map.addSource('salida-route', { type: 'geojson', data: empty });
      map.addLayer({
        id: 'salida-route',
        type: 'line',
        source: 'salida-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#E07A2F',
          'line-width': 4,
          'line-opacity': 0.92
        }
      });
    }
    if (!map.getSource('salida-markers')) {
      map.addSource('salida-markers', { type: 'geojson', data: empty });
      map.addLayer({
        id: 'salida-markers',
        type: 'circle',
        source: 'salida-markers',
        filter: ['==', ['get', 'sport'], ''],
        paint: {
          'circle-radius': markerRadius,
          'circle-color': ['coalesce', ['get', 'color'], '#2457D6'],
          'circle-stroke-width': markerStroke,
          'circle-stroke-color': '#FFFCF8'
        }
      });
      map.addLayer({
        id: 'salida-sports',
        type: 'symbol',
        source: 'salida-markers',
        filter: ['!=', ['get', 'sport'], ''],
        layout: {
          'icon-image': [
            'match', ['get', 'sport'],
            'run', 'salida-sport-run',
            'cycle', 'salida-sport-cycle',
            'football', 'salida-sport-football',
            'basketball', 'salida-sport-basketball',
            'padel', 'salida-sport-padel',
            'salida-sport-run'
          ],
          'icon-size': sportSize,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        }
      });
      map.addLayer({
        id: 'salida-markers-hit',
        type: 'circle',
        source: 'salida-markers',
        paint: { 'circle-radius': 18, 'circle-color': '#000000', 'circle-opacity': 0.01 }
      });
    }
    if (!map.getLayer('salida-me-mark')) {
      map.addLayer({
        id: 'salida-me-mark',
        type: 'symbol',
        source: 'salida-me',
        layout: {
          'icon-image': 'salida-puck',
          'icon-size': puckSize,
          'icon-rotate': ['coalesce', ['get', 'heading'], 0],
          'icon-rotation-alignment': 'map',
          'icon-pitch-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        }
      });
    }
    aimMe(me);
    drawPuck();
    map.getSource('salida-route').setData({
      type: 'FeatureCollection',
      features: lines.map(function (item) { return lineFeature(item); })
    });
    map.getSource('salida-markers').setData({
      type: 'FeatureCollection',
      features: markers.map(function (item) { return pointFeature(item.longitude, item.latitude, item.id, item.color, 0, item.sport); })
    });
    drawReferences(true);
  }
  let refLimit = -1;
  function referenceLimit(zoom) {
    if (zoom < 16) return 0;
    if (zoom < 16.8) return 1;
    if (zoom < 17.6) return 3;
    return places.length;
  }
  function referenceData(limit) {
    return {
      type: 'FeatureCollection',
      features: places.slice(0, limit).map(function (item, index) {
        return {
          type: 'Feature',
          properties: { name: item.name, sort: index },
          geometry: { type: 'Point', coordinates: [item.longitude, item.latitude] }
        };
      })
    };
  }
  function drawReferences(force) {
    const limit = referenceLimit(map.getZoom());
    if (!map.getSource('salida-refs')) {
      refLimit = limit;
      const dark = styleId === 'dark' || styleId === 'fiord';
      map.addSource('salida-refs', { type: 'geojson', data: referenceData(limit) });
      map.addLayer({
        id: 'salida-refs-dot',
        type: 'circle',
        source: 'salida-refs',
        paint: {
          'circle-radius': 3.5,
          'circle-color': dark ? '#F4F1EA' : '#3A342C',
          'circle-stroke-width': 1.5,
          'circle-stroke-color': dark ? '#141414' : '#FFFCF8'
        }
      });
      map.addLayer({
        id: 'salida-refs',
        type: 'symbol',
        source: 'salida-refs',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 12,
          'text-max-width': 9,
          'text-anchor': 'top',
          'text-offset': [0, 0.55],
          'text-padding': 8,
          'symbol-sort-key': ['get', 'sort']
        },
        paint: {
          'text-color': dark ? '#F4F1EA' : '#2C2C2C',
          'text-halo-color': dark ? '#141414' : '#FFFCF8',
          'text-halo-width': 1.4
        }
      });
      return;
    }
    if (!force && limit === refLimit) return;
    refLimit = limit;
    map.getSource('salida-refs').setData(referenceData(limit));
  }
  function send(payload) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }
  map.on('load', function () {
    overlays();
    syncNorth();
    let zoomSent = -1;
    function publishZoom() {
      const zoom = map.getZoom();
      if (Math.abs(zoom - zoomSent) < 0.15) return;
      zoomSent = zoom;
      send({ type: 'zoom', zoom: zoom });
    }
    map.on('zoom', function () {
      publishZoom();
      if (map.getSource('salida-refs')) drawReferences(false);
    });
    publishZoom();
    function openMarker(event) {
      const feature = event.features && event.features[0];
      if (feature && feature.properties && feature.properties.id) send({ type: 'marker', id: String(feature.properties.id) });
    }
    map.on('click', 'salida-markers-hit', openMarker);
    map.on('click', 'salida-sports', openMarker);
    send({ type: 'ready' });
  });
  map.on('style.load', overlays);
  map.on('moveend', function () {
    if (driven) {
      driven = false;
      return;
    }
    if (!map.isStyleLoaded()) return;
    const center = map.getCenter();
    send({ type: 'center', latitude: center.lat, longitude: center.lng });
  });
  window.applyMap = function (message) {
    let restyle = false;
    if (message.styleId && STYLES[message.styleId] && message.styleId !== styleId) {
      styleId = message.styleId;
      restyle = true;
      map.setStyle(STYLES[styleId]);
    }
    if (message.markers) markers = message.markers;
    if (message.lines) lines = message.lines;
    if (message.places) places = message.places;
    if (message.me !== undefined) me = message.me;
    if (typeof message.heading === 'number') aimHeading(message.heading);
    if (message.release) {
      if (followId > cancelledFollow) cancelledFollow = followId;
      followId = 0;
      compassMode = 'north';
      syncNorth();
    }
    if (!restyle && map.isStyleLoaded() && (message.markers || message.lines || message.places || message.me !== undefined)) overlays();
    if (message.follow && message.follow.token > cancelledFollow) {
      const nextId = message.follow.token || followId || 1;
      followId = nextId;
      compassMode = message.follow.mode === 'heading' ? 'heading' : 'north';
      if (nextId !== followZoomToken) {
        followZoomToken = nextId;
        const camera = { zoom: Math.max(map.getZoom(), 16) };
        if (shownMe) {
          camera.center = [shownMe.longitude, shownMe.latitude];
          camera.bearing = compassMode === 'heading' ? shownHeading : 0;
        }
        driven = true;
        map.jumpTo(camera);
      }
      syncNorth();
    }
    if (message.focus && followId === 0) {
      map.easeTo({
        center: [message.focus.longitude, message.focus.latitude],
        zoom: Math.max(map.getZoom(), message.focus.zoom || 15),
        bearing: 0
      });
    }
    if (message.zoomDelta) {
      if (message.zoomDelta > 0) map.zoomIn();
      else map.zoomOut();
    }
  };
</script>
</body>
</html>`;
}

function pinMeasure(zoom: number) {
  const span = Math.min(1, Math.max(0, (zoom - 14) / 6));
  const size = Math.round(6 + span * 24);
  return { size, border: size > 16 ? 3 : 2 };
}

export function CityMap({ markers, lines = [], places = [], me, heading = null, focus, followToken = 0, bearingMode = 'north', onUserMove, showCenterPin, centerColor = '#2457D6', rounded = true, onCenter, onSelect }: CityMapProps) {
  const styleId = useMapStyle();
  const webRef = useRef<MapHandle>(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(14);
  const pin = pinMeasure(zoom);
  const focusToken = focus?.token ?? 0;
  const source = useMemo(
    () => ({ html: mapHtml(styleId), baseUrl: `${MAP_LIB}/` }),
    // The page is created once. Later style changes go through applyMap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (!ready) {
      return;
    }
    const payload = { styleId, markers, lines, places };
    webRef.current?.injectJavaScript(`window.applyMap && window.applyMap(${JSON.stringify(payload)}); true;`);
  }, [styleId, markers, lines, places, ready]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    webRef.current?.injectJavaScript(`window.applyMap && window.applyMap(${JSON.stringify({ me: me ?? null })}); true;`);
  }, [me, ready]);

  useEffect(() => {
    if (!ready || typeof heading !== 'number') {
      return;
    }
    webRef.current?.injectJavaScript(`window.applyMap && window.applyMap(${JSON.stringify({ heading })}); true;`);
  }, [heading, ready]);

  useEffect(() => {
    if (!ready || !focus) {
      return;
    }
    const payload = { focus: { latitude: focus.latitude, longitude: focus.longitude, zoom: 15 } };
    webRef.current?.injectJavaScript(`window.applyMap && window.applyMap(${JSON.stringify(payload)}); true;`);
  }, [focus, focusToken, ready]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    const payload = followToken > 0 ? { follow: { token: followToken, mode: bearingMode } } : { release: true };
    webRef.current?.injectJavaScript(`window.applyMap && window.applyMap(${JSON.stringify(payload)}); true;`);
  }, [ready, followToken, bearingMode]);

  function onMessage(event: { nativeEvent: { data: string } }) {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { type?: string; latitude?: number; longitude?: number; id?: string; zoom?: number };
      if (data.type === 'ready') {
        setReady(true);
      }
      if (data.type === 'zoom' && typeof data.zoom === 'number') {
        setZoom(data.zoom);
      }
      if (data.type === 'center' && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        onCenter?.({ latitude: data.latitude, longitude: data.longitude });
      }
      if (data.type === 'marker' && data.id) {
        onSelect?.(data.id);
      }
      if (data.type === 'gesture') {
        onUserMove?.();
      }
    } catch {
      // Ignore a partial message from the map page.
    }
  }

  return (
    <View style={[styles.frame, rounded ? styles.rounded : null]}>
      <MapWeb
        ref={webRef}
        originWhitelist={['*']}
        source={source}
        userAgent="Salida/1.0 (Android; Pasto; contacto@salida.app)"
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        scrollEnabled={false}
        nestedScrollEnabled
        androidLayerType="hardware"
        style={styles.map}
      />
      {showCenterPin ? (
        <View pointerEvents="none" style={styles.pinWrap}>
          <View style={[styles.pin, { width: pin.size, height: pin.size, borderRadius: pin.size / 2, borderWidth: pin.border, backgroundColor: centerColor }]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    minHeight: 240,
    overflow: 'hidden',
  },
  rounded: {
    borderRadius: 20,
  },
  map: {
    flex: 1,
    backgroundColor: '#E4DDD4',
  },
  pinWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pin: {
    backgroundColor: '#2457D6',
    borderColor: '#FFFCF8',
  },
});
