import { Image } from 'expo-image';

import type { SportId } from '@/domain/profile';

export const SPORT_COLOR: Record<SportId, string> = {
  run: '#F07167',
  cycle: '#6BA7F5',
  padel: '#2457D6',
  football: '#1F9D55',
  basketball: '#F08A2A',
};

const ICONS: Record<SportId, number> = {
  run: require('../../assets/sports/mark-run.png'),
  cycle: require('../../assets/sports/mark-cycle.png'),
  padel: require('../../assets/sports/mark-padel.png'),
  football: require('../../assets/sports/mark-football.png'),
  basketball: require('../../assets/sports/mark-basketball.png'),
};

export function SportMark({ sport, size = 28 }: { sport: SportId; size?: number }) {
  return (
    <Image
      source={ICONS[sport]}
      style={{ width: size, height: size, backgroundColor: 'transparent' }}
      contentFit="contain"
      accessibilityIgnoresInvertColors
    />
  );
}
