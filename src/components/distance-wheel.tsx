import { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  BASE_DISTANCES,
  baseTitle,
  distanceCaption,
  distanceWheelLabel,
  wheelDistances,
  type BaseDistance,
  type RouteDistance,
} from '@/domain/route-distance';
import { useColors, type Palette } from '@/theme/colors';

const ROW = 48;
const ROWS = 5;

type WheelList = {
  scrollTo: (options: { y?: number; animated?: boolean }) => void;
};

type DistanceWheelProps = {
  value: RouteDistance;
  onChange: (value: RouteDistance) => void;
};

export function DistanceWheel({ value, onChange }: DistanceWheelProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const values = useMemo(wheelDistances, []);
  const list = useRef<WheelList | null>(null);
  const skipScroll = useRef(false);
  const laidOut = useRef(false);

  useEffect(() => {
    if (skipScroll.current) {
      skipScroll.current = false;
      return;
    }
    const index = Math.max(0, values.indexOf(value));
    requestAnimationFrame(() => list.current?.scrollTo({ y: index * ROW, animated: laidOut.current }));
  }, [value, values]);

  function commit(offsetY: number) {
    const index = Math.max(0, Math.min(values.length - 1, Math.round(offsetY / ROW)));
    const next = values[index];
    if (next === undefined || next === value) {
      return;
    }
    skipScroll.current = true;
    onChange(next);
  }

  function chooseBase(km: BaseDistance) {
    if (km !== value) {
      onChange(km);
    }
  }

  return (
    <View style={styles.row}>
      <View style={styles.wheel}>
        <View pointerEvents="none" style={styles.band} />
        <ScrollView
          ref={(node) => {
            list.current = node as WheelList | null;
          }}
          style={styles.scroller}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          snapToInterval={ROW}
          decelerationRate="fast"
          nestedScrollEnabled
          onLayout={() => {
            if (laidOut.current) {
              return;
            }
            laidOut.current = true;
            const index = Math.max(0, values.indexOf(value));
            list.current?.scrollTo({ y: index * ROW, animated: false });
          }}
          onMomentumScrollEnd={(event) => commit(event.nativeEvent.contentOffset.y)}
          onScrollEndDrag={(event) => {
            if (event.nativeEvent.velocity?.y === 0) {
              commit(event.nativeEvent.contentOffset.y);
            }
          }}>
          {values.map((item) => {
            const selected = item === value;
            return (
              <View key={String(item)} style={styles.item}>
                <Text style={selected ? styles.valueOn : styles.value}>{distanceWheelLabel(item)}</Text>
                <Text style={selected ? styles.captionOn : styles.caption}>{distanceCaption(item)}</Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
      <View style={styles.bases}>
        {BASE_DISTANCES.map((km) => {
          const selected = value === km;
          return (
            <Pressable
              key={km}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => chooseBase(km)}
              style={[styles.base, selected ? styles.baseOn : null]}>
              <Text style={selected ? styles.baseLabelOn : styles.baseLabel}>{baseTitle(km)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 10,
      minHeight: ROW * ROWS,
    },
    wheel: {
      flex: 1,
      height: ROW * ROWS,
      borderRadius: 16,
      backgroundColor: colors.card,
      overflow: 'hidden',
    },
    band: {
      position: 'absolute',
      left: 8,
      right: 8,
      top: ROW * 2,
      height: ROW,
      borderRadius: 12,
      backgroundColor: colors.actionSoft,
    },
    scroller: {
      flex: 1,
    },
    content: {
      paddingVertical: ROW * 2,
    },
    item: {
      height: ROW,
      alignItems: 'center',
      justifyContent: 'center',
    },
    value: {
      color: colors.placeholder,
      fontSize: 18,
      fontWeight: '600',
    },
    valueOn: {
      color: colors.ink,
      fontSize: 22,
      fontWeight: '700',
    },
    caption: {
      color: colors.placeholder,
      fontSize: 11,
      fontWeight: '500',
    },
    captionOn: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '600',
    },
    bases: {
      width: 132,
      justifyContent: 'space-between',
    },
    base: {
      minHeight: 36,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.line,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    baseOn: {
      borderColor: colors.action,
      backgroundColor: colors.actionSoft,
    },
    baseLabel: {
      color: colors.ink,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
    },
    baseLabelOn: {
      color: colors.ink,
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center',
    },
  });
}
