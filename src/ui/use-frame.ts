import { useWindowDimensions } from 'react-native';

export function useFrame() {
  const { width, height } = useWindowDimensions();
  const tablet = width >= 840;
  const wide = width >= 600;
  const gutter = tablet ? 24 : width < 390 ? 16 : 20;
  return { width, height, tablet, wide, gutter };
}
