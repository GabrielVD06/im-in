import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { useProfile } from '@/state/profile-context';
import { useColors, type Palette } from '@/theme/colors';
import { useFrame } from '@/ui/use-frame';

export default function FotoScreen() {
  const { profile, save } = useProfile();
  const [photoUri, setPhotoUri] = useState<string | null>(profile.photoUri);
  const [message, setMessage] = useState('');
  const colors = useColors();
  const frame = useFrame();
  const photoSize = Math.min(200, frame.width - frame.gutter * 2);
  const styles = useMemo(() => createStyles(colors, photoSize), [colors, photoSize]);

  async function pickPhoto() {
    setMessage('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessage('Para elegir la foto, autoriza el acceso a tus imágenes en el teléfono.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      setPhotoUri(result.assets[0]?.uri ?? null);
    }
  }

  async function finish() {
    if (!photoUri) {
      setMessage('Elige una foto donde se te vea la cara.');
      return;
    }
    await save({ photoUri, completedAt: new Date().toISOString() });
    router.replace('/entreno');
  }

  return (
    <Screen
      step={5}
      total={5}
      title="Una foto tuya."
      subtitle="Puede ser entrenando. Tiene que verse tu cara, para que quien vaya a quedar contigo sepa con quién habla."
      onBack={() => router.back()}
      footer={<Button label="Guardar perfil" onPress={finish} />}>
      <View style={styles.frame}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" accessibilityLabel="Foto de perfil" />
        ) : (
          <Text style={styles.placeholder}>Aún no hay foto</Text>
        )}
      </View>
      <Button label={photoUri ? 'Cambiar foto' : 'Elegir foto'} variant="quiet" onPress={pickPhoto} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </Screen>
  );
}

function createStyles(colors: Palette, photoSize: number) {
  return StyleSheet.create({
    frame: {
      width: photoSize,
      height: photoSize,
      borderRadius: photoSize / 2,
      alignSelf: 'center',
      backgroundColor: colors.photo,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    photo: {
      width: '100%',
      height: '100%',
    },
    placeholder: {
      color: colors.onPhoto,
      fontSize: 16,
    },
    message: {
      color: colors.danger,
      fontSize: 14,
    },
  });
}
