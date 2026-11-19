import { router } from 'expo-router';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';

export default function BienvenidaScreen() {
  return (
    <Screen
      title="I'm in"
      subtitle="Sal a hacer deporte con gente de tu nivel. En Pasto, por ahora. Elige el plan, mira quién va y queda."
      footer={<Button label="Empezar" onPress={() => router.push('/alta/edad')} />}
    />
  );
}
