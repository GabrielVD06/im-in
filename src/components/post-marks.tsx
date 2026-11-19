import { useEffect, useId, useRef } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

const SIZE = 26;

const HEART =
  'M12 20.2C7.4 16.6 4.2 13.8 4.2 10 4.2 7.2 6.4 5.2 9.1 5.2 10.6 5.2 11.7 6 12 7.1 12.3 6 13.4 5.2 14.9 5.2 17.6 5.2 19.8 7.2 19.8 10 19.8 13.8 16.6 16.6 12 20.2Z';

const PLANE = 'M3.2 11.2 20.8 3.4 13.2 20.6 10.8 13.2 3.2 11.2z';
const PLANE_FOLD = 'M10.8 13.2 20.8 3.4';

const BUBBLE =
  'M7 3.2h10c2.1 0 3.8 1.6 3.8 3.6v6.2c0 2-1.7 3.6-3.8 3.6h-3.2L8.2 20.4l.8-3.8H7c-2.1 0-3.8-1.6-3.8-3.6V6.8c0-2 1.7-3.6 3.8-3.6z';

type MarkProps = {
  color: string;
};

function HeartShape({ filled, color, size, gradientId }: { filled: boolean; color: string; size: number; gradientId: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {filled ? (
        <>
          <Defs>
            <LinearGradient id={gradientId} x1="12" y1="5" x2="12" y2="20.2" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#8E1428" />
              <Stop offset="0.55" stopColor="#E10600" />
              <Stop offset="1" stopColor="#FF3A30" />
            </LinearGradient>
          </Defs>
          <Path d={HEART} fill={`url(#${gradientId})`} />
        </>
      ) : (
        <Path d={HEART} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="miter" strokeMiterlimit={2.5} />
      )}
    </Svg>
  );
}

export function HeartMark({ filled, color, still = false, size = SIZE }: { filled: boolean; color: string; still?: boolean; size?: number }) {
  const gradientId = `salida-heart-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const scale = useSharedValue(1);
  const wasFilled = useRef(filled);
  useEffect(() => {
    if (still) {
      wasFilled.current = filled;
      return;
    }
    if (filled && !wasFilled.current) {
      scale.value = withSequence(withTiming(1.34, { duration: 120 }), withSpring(1, { damping: 7, stiffness: 280 }));
    } else if (!filled && wasFilled.current) {
      scale.value = withSequence(withTiming(0.86, { duration: 90 }), withTiming(1, { duration: 120 }));
    }
    wasFilled.current = filled;
  }, [filled, scale, still]);
  const bounce = useAnimatedStyle(() => ({ transform: [{ scale: still ? 1 : scale.value }] }));
  return (
    <Animated.View style={bounce}>
      <HeartShape filled={filled} color={color} size={size} gradientId={gradientId} />
    </Animated.View>
  );
}

export function CommentMark({ color }: MarkProps) {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24">
      <Path d={BUBBLE} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

export function ShareMark({ color }: MarkProps) {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24">
      <Path d={PLANE} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <Path d={PLANE_FOLD} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}
