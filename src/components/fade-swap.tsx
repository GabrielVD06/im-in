import { type ReactNode, useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

type FadeSwapProps = {
  pageKey: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function FadeSwap({ pageKey, children, style }: FadeSwapProps) {
  const opacity = useSharedValue(1);
  const shift = useSharedValue(0);

  useEffect(() => {
    opacity.value = 0.35;
    shift.value = 18;
    opacity.value = withTiming(1, { duration: 260 });
    shift.value = withTiming(0, { duration: 260 });
  }, [pageKey, opacity, shift]);

  const animated = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: shift.value }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
