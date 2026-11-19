import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Screen } from '@/components/screen';
import { useProfile } from '@/state/profile-context';
import { useColors } from '@/theme/colors';

export default function EditarScreen() {
  const { profile, save } = useProfile();
  const colors = useColors();
  const [photoUri, setPhotoUri] = useState(profile.photoUri);
  const [bio, setBio] = useState(profile.bio);
  const [message, setMessage] = useState('');

  async function pickPhoto() {
    setMessage('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessage('Para cambiar la foto, autoriza el acceso a tus imágenes.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    const uri = result.canceled ? null : result.assets[0]?.uri;
    if (uri) {
      setPhotoUri(uri);
    }
  }

  async function saveProfile() {
    await save({ photoUri, bio: bio.trim() });
    setMessage('Perfil guardado.');
  }

  return (
    <Screen title="Editar perfil" subtitle="La foto y una descripción corta. Estatura y peso siguen en Datos." onBack={() => router.back()} footerMode="flow">
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={{ width: 120, height: 120, borderRadius: 60, alignSelf: 'center' }} contentFit="cover" accessibilityLabel="Tu foto" />
      ) : (
        <Text style={{ color: colors.muted, fontSize: 15, textAlign: 'center' }}>Todavía no hay foto.</Text>
      )}
      <Button label={photoUri ? 'Cambiar foto' : 'Elegir foto'} variant="quiet" onPress={pickPhoto} />
      <Field label="Descripción" value={bio} onChangeText={setBio} placeholder="Algo corto sobre ti" multiline maxLength={160} autoCorrect />
      <Button label="Guardar" onPress={saveProfile} />
      {message ? <Text style={{ color: colors.action, fontSize: 14, lineHeight: 20 }}>{message}</Text> : null}
    </Screen>
  );
}
