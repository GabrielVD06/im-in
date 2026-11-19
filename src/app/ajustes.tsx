import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Text } from 'react-native';

import { Button, Choice } from '@/components/button';
import { Field } from '@/components/field';
import { SectionLabel } from '@/components/panel';
import { Screen } from '@/components/screen';
import { consentAccepted, isValidEmail, upsertConsent } from '@/domain/profile';
import { useProfile } from '@/state/profile-context';
import { useSocial } from '@/state/social-context';
import { useDeviceLocation } from '@/state/use-device-location';
import { setThemeChoice, useColors, useThemeChoice, type ThemeChoice } from '@/theme/colors';
import { MAP_STYLES, setMapStyle, useMapStyle, type MapStyleId } from '@/theme/map-style';

const THEMES: { id: ThemeChoice; label: string }[] = [
  { id: 'light', label: 'Clara' },
  { id: 'dark', label: 'Oscura' },
  { id: 'system', label: 'Como el teléfono' },
];

export default function AjustesScreen() {
  const { profile, save, reset } = useProfile();
  const social = useSocial();
  const colors = useColors();
  const theme = useThemeChoice();
  const mapStyle = useMapStyle();
  const { locate } = useDeviceLocation();
  const [name, setName] = useState(profile.name);
  const [lastName, setLastName] = useState(profile.lastName);
  const [email, setEmail] = useState(profile.email);
  const [message, setMessage] = useState('');
  const locationOn = consentAccepted(profile, 'location');
  const faceOn = consentAccepted(profile, 'face');

  async function saveAccount() {
    if (!name.trim() || !lastName.trim()) {
      setMessage('Escribe nombre y apellido.');
      return;
    }
    if (!isValidEmail(email)) {
      setMessage('El correo no parece válido.');
      return;
    }
    await save({
      name: name.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
    });
    setMessage('Datos guardados.');
  }

  async function enableLocation() {
    const next = await locate();
    if (next) {
      await save({ consents: upsertConsent(profile, 'location', true) });
      setMessage('Ubicación activada. El mapa de Inicio se centra en tu punto.');
      return;
    }
    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== 'granted' && !permission.canAskAgain) {
      await Linking.openSettings();
      return;
    }
    setMessage('Sin el permiso del teléfono, el mapa no puede usar tu punto.');
  }

  async function disableLocation() {
    await save({ consents: upsertConsent(profile, 'location', false) });
    setMessage('La app deja de centrar el mapa sola. El permiso del teléfono sigue en los ajustes del sistema.');
  }

  async function toggleFace() {
    await save({ consents: upsertConsent(profile, 'face', !faceOn) });
    setMessage(faceOn ? 'Quitaste la verificación de cara.' : 'Guardamos el permiso. La cámara llega después.');
  }

  async function startOver() {
    await social.clear();
    await reset();
    router.replace('/alta/bienvenida');
  }

  return (
    <Screen
      title="Ajustes"
      subtitle="Tu cuenta, la apariencia y el mapa de este teléfono."
      onBack={() => router.back()}
      footerMode="flow"
      footer={<Button label="Borrar perfil de este teléfono" variant="quiet" onPress={startOver} />}>
      <SectionLabel>Cuenta</SectionLabel>
      <Field label="Nombre" value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label="Apellido" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
      <Field label="Correo" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      <Button label="Guardar datos" onPress={saveAccount} />
      <SectionLabel>Apariencia</SectionLabel>
      {THEMES.map((option) => (
        <Choice key={option.id} label={option.label} selected={theme === option.id} onPress={() => setThemeChoice(option.id)} />
      ))}
      <SectionLabel>Mapa</SectionLabel>
      {MAP_STYLES.map((option) => (
        <Choice
          key={option.id}
          label={option.label}
          detail={option.detail}
          selected={mapStyle === option.id}
          onPress={() => setMapStyle(option.id as MapStyleId)}
        />
      ))}
      <SectionLabel>Privacidad</SectionLabel>
      <Choice
        label={profile.commentsOpen ? 'Comentarios abiertos' : 'Comentarios apagados'}
        detail="Si los apagas, en tus fotos no aparece el campo para comentar."
        selected={profile.commentsOpen}
        onPress={() => save({ commentsOpen: !profile.commentsOpen })}
      />
      <Choice
        label={profile.likesPublic ? 'Likes visibles' : 'Likes en privado'}
        detail="En privado, el número y quién dio like solo lo ves tú."
        selected={profile.likesPublic}
        onPress={() => save({ likesPublic: !profile.likesPublic })}
      />
      <SectionLabel>Ubicación</SectionLabel>
      <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
        {locationOn ? 'El mapa puede centrarse en tu punto. A otras personas no se les publica ese punto.' : 'Está apagada. Sin ella, Inicio abre en el centro de Pasto.'}
      </Text>
      <Button label={locationOn ? 'Desactivar en la app' : 'Usar mi ubicación'} variant={locationOn ? 'quiet' : 'primary'} onPress={locationOn ? disableLocation : enableLocation} />
      <SectionLabel>Verificación</SectionLabel>
      <Choice label={faceOn ? 'Cara autorizada' : 'Autorizar verificación de cara'} selected={faceOn} onPress={toggleFace} />
      <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>La cámara todavía no está conectada. El permiso queda guardado.</Text>
      {message ? <Text style={{ color: colors.action, fontSize: 14, lineHeight: 20 }}>{message}</Text> : null}
    </Screen>
  );
}
