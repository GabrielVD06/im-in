import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useColors } from '@/theme/colors';

type Option = { id: string; label: string };

type PageSwitchProps = {
  value: string;
  options: Option[];
  onChange: (id: string) => void;
};

export function PageSwitch({ value, options, onChange }: PageSwitchProps) {
  const colors = useColors();
  const [slots, setSlots] = useState<Record<string, { x: number; width: number }>>({});
  const x = useSharedValue(0);
  const active = slots[value];

  useEffect(() => {
    if (!active) {
      return;
    }
    x.value = withTiming(active.x + (active.width - 28) / 2, { duration: 240 });
  }, [active, x]);

  const indicator = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  return (
    <View style={[styles.row, { borderBottomColor: colors.line }]}>
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.id)}
            onLayout={(event) => {
              const next = { x: event.nativeEvent.layout.x, width: event.nativeEvent.layout.width };
              setSlots((current) => {
                const previous = current[option.id];
                if (previous && previous.x === next.x && previous.width === next.width) {
                  return current;
                }
                return { ...current, [option.id]: next };
              });
            }}
            style={styles.tab}>
            <Text style={[styles.label, { color: selected ? colors.ink : colors.muted, fontWeight: selected ? '700' : '500' }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
      <Animated.View style={[styles.indicator, { backgroundColor: colors.ink }, indicator]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 46,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  label: {
    fontSize: 16,
  },
  indicator: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: 28,
    height: 3,
    borderRadius: 2,
  },
});
