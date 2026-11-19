import { router } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Screen } from '@/components/screen';
import { isValidEmail } from '@/domain/profile';
import { useProfile } from '@/state/profile-context';

export default function RegistroScreen() {
  const { profile, save } = useProfile();
  const [name, setName] = useState(profile.name);
  const [lastName, setLastName] = useState(profile.lastName);
  const [email, setEmail] = useState(profile.email);
  const [error, setError] = useState<{ name?: string; lastName?: string; email?: string }>({});

  async function continueNext() {
    const nextName = name.trim();
    const nextLastName = lastName.trim();
    const nextEmail = email.trim().toLowerCase();
    const nextError = {
      name: nextName.length < 2 ? 'Escribe tu nombre.' : undefined,
      lastName: nextLastName.length < 2 ? 'Escribe tu apellido.' : undefined,
      email: isValidEmail(nextEmail) ? undefined : 'Escribe un correo válido.',
    };
    setError(nextError);
    if (nextError.name || nextError.lastName || nextError.email) {
      return;
    }
    await save({ name: nextName, lastName: nextLastName, email: nextEmail, username: '' });
    router.push('/alta/deportes');
  }

  return (
    <Screen
      step={3}
      total={5}
      title="¿Cómo te llamas?"
      subtitle="Nombre, apellido y correo. En esta prueba el perfil queda guardado en el teléfono."
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
    </Screen>
  );
}
