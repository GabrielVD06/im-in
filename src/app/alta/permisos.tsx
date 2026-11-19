import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { CONSENT_VERSION, type ConsentId } from '@/domain/profile';
import { useProfile } from '@/state/profile-context';
import { useColors, type Palette } from '@/theme/colors';

const OPTIONS: {
  id: ConsentId;
  title: string;
  required: boolean;
  body: string;
}[] = [
  {
    id: 'account',
    title: 'Cuenta',
    required: true,
    body: 'Guardamos tu nombre, tu apellido, tu correo y tu foto para crear el perfil. Sin este permiso no se puede abrir la cuenta.',
  },
  {
    id: 'location',
    title: 'Ubicación',
    required: false,
    body: 'Sirve para mostrar salidas y canchas dentro del rango que elijas. A las demás personas se les muestra un punto aproximado, no tu ubicación exacta. Si no la autorizas, puedes buscar en Pasto moviendo el mapa.',
  },
  {
    id: 'face',
    title: 'Cara',
    required: false,
    body: 'Es un dato sensible y no estás obligado a autorizarlo. Servirá para comprobar que la foto del perfil es tuya. La prueba con la cámara llega en una versión siguiente: ahora solo guardamos tu decisión. Si no aceptas, usas I\'m in sin marca de verificado.',
  },
];

export default function PermisosScreen() {
  const { profile, save } = useProfile();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const initial = Object.fromEntries(
    OPTIONS.map((option) => [option.id, profile.consents.find((item) => item.id === option.id)?.accepted ?? false]),
  ) as Record<ConsentId, boolean>;
  const [choices, setChoices] = useState(initial);

  function toggle(id: ConsentId) {
    setChoices((current) => ({ ...current, [id]: !current[id] }));
  }

  async function continueNext() {
    const at = new Date().toISOString();
    await save({
      consents: OPTIONS.map((option) => ({
        id: option.id,
        accepted: choices[option.id],
        version: CONSENT_VERSION,
        at,
      })),
    });
    router.push('/alta/registro');
  }

  return (
    <Screen
      step={2}
      total={5}
      title="Cada permiso va por separado."
      subtitle="Puedes seguir sin la ubicación y sin la cara. La cuenta sí hace falta."
      onBack={() => router.back()}
      footer={<Button label="Seguir" disabled={!choices.account} onPress={continueNext} />}>
      {OPTIONS.map((option) => {
        const accepted = choices[option.id];
        return (
          <View key={option.id} style={styles.card}>
            <View style={styles.heading}>
              <Text style={styles.title}>{option.title}</Text>
              <Text style={styles.tag}>{option.required ? 'Necesario' : 'Opcional'}</Text>
            </View>
            <Text style={styles.body}>{option.body}</Text>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={`${option.title}. ${accepted ? 'Autorizado' : 'Autorizar'}`}
              accessibilityState={{ checked: accepted }}
              onPress={() => toggle(option.id)}
              style={styles.checkRow}>
              <View style={[styles.box, accepted ? styles.boxOn : null]}>
                {accepted ? <Text style={styles.mark}>✓</Text> : null}
              </View>
              <Text style={styles.checkLabel}>{accepted ? 'Autorizado' : 'Autorizar'}</Text>
            </Pressable>
          </View>
        );
      })}
    </Screen>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.line,
      padding: 16,
      gap: 10,
    },
    heading: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    title: {
      color: colors.ink,
      fontSize: 18,
      fontWeight: '500',
    },
    tag: {
      color: colors.muted,
      fontSize: 13,
    },
    body: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 21,
    },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 44,
      paddingTop: 4,
    },
    box: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    boxOn: {
      backgroundColor: colors.action,
      borderColor: colors.action,
    },
    mark: {
      color: colors.onAction,
      fontSize: 14,
      fontWeight: '500',
    },
    checkLabel: {
      color: colors.ink,
      fontSize: 16,
      fontWeight: '500',
    },
  });
}
