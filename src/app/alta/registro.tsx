import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button } from '@/components/button';
import { CityPicker } from '@/components/city-picker';
import { Field } from '@/components/field';
import { Screen } from '@/components/screen';
import { matchCity } from '@/domain/cities';
import { cityAt } from '@/domain/city-name';
import { consentAccepted, isValidEmail } from '@/domain/profile';
import { useProfile } from '@/state/profile-context';
import { useDeviceLocation } from '@/state/use-device-location';
import { useColors, type Palette } from '@/theme/colors';

export default function RegistroScreen() {
  const { profile, save } = useProfile();
  const locationOn = consentAccepted(profile, 'location');
  const { locate } = useDeviceLocation();
  const [name, setName] = useState(profile.name);
  const [lastName, setLastName] = useState(profile.lastName);
  const [email, setEmail] = useState(profile.email);
  const [city, setCity] = useState(matchCity(profile.city)?.name ?? '');
  const [error, setError] = useState<{ name?: string; lastName?: string; email?: string; city?: string }>({});
  const [googleNote, setGoogleNote] = useState(false);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const picked = useRef(Boolean(matchCity(profile.city)));

  useEffect(() => {
    if (!locationOn || picked.current) {
      return;
    }
    let alive = true;
    locate().then(async (next) => {
      if (!alive || !next || picked.current) {
        return;
      }
      const found = await cityAt(next);
      if (!alive || !found || picked.current) {
        return;
      }
      const match = matchCity(found.name, found.region);
      if (match) {
        setCity(match.name);
      }
    });
    return () => {
      alive = false;
    };
  }, [locationOn, locate]);

  async function continueNext() {
    const nextName = name.trim();
    const nextLastName = lastName.trim();
    const nextEmail = email.trim().toLowerCase();
    const chosen = matchCity(city);
    const nextError = {
      name: nextName.length < 2 ? 'Escribe tu nombre.' : undefined,
      lastName: nextLastName.length < 2 ? 'Escribe tu apellido.' : undefined,
      email: isValidEmail(nextEmail) ? undefined : 'Escribe un correo válido.',
      city: chosen ? undefined : 'Elige tu ciudad.',
    };
    setError(nextError);
    if (nextError.name || nextError.lastName || nextError.email || nextError.city) {
      return;
    }
    await save({ name: nextName, lastName: nextLastName, email: nextEmail, username: '', city: chosen?.name ?? city });
    router.push('/alta/deportes');
  }

  return (
    <Screen
      step={3}
      total={5}
      title="¿Cómo te llamas?"
      subtitle="Nombre, apellido, correo y ciudad. En esta prueba el perfil queda guardado en el teléfono."
      onBack={() => router.back()}
      footer={<Button label="Seguir" onPress={continueNext} />}
      footerMode="flow">
      <Field label="Nombre" value={name} onChangeText={setName} placeholder="Tu nombre" autoCapitalize="words" error={error.name} />
      <Field
        label="Apellido"
        value={lastName}
        onChangeText={setLastName}
        placeholder="Tu apellido"
        autoCapitalize="words"
        error={error.lastName}
      />
      <Field
        label="Correo"
        value={email}
        onChangeText={setEmail}
        placeholder="tu@correo.com"
        keyboardType="email-address"
        autoCapitalize="none"
        error={error.email}
      />
      <Button label="Continuar con Google" variant="quiet" onPress={() => setGoogleNote(true)} />
      {googleNote ? (
        <Text style={styles.note}>La entrada con Google se conecta cuando esté el cliente de la cuenta. Mientras, usa tu correo.</Text>
      ) : null}
      <CityPicker
        value={city}
        error={error.city}
        onChange={(next) => {
          picked.current = true;
          setCity(next);
        }}
      />
      {locationOn ? <Text style={styles.note}>Si la ubicación está activa, la ciudad se completa sola y cambia cuando te mueves.</Text> : null}
    </Screen>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    note: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
    },
  });
}
