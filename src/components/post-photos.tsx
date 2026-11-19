import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

type PostPhotosProps = {
  uris: string[];
  width: number;
  onPress?: () => void;
};

export function PostPhotos({ uris, width, onPress }: PostPhotosProps) {
  const [page, setPage] = useState(0);
  const height = Math.round((width * 5) / 4);
  const current = Math.min(page, Math.max(0, uris.length - 1));

  return (
    <View style={{ width, height }}>
      <ScrollView
        horizontal
        pagingEnabled
        bounces={uris.length > 1}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const next = Math.round(event.nativeEvent.contentOffset.x / width);
          setPage(next);
        }}>
        {uris.map((uri, index) => {
          const photo = <Image source={{ uri }} style={{ width, height }} contentFit="cover" accessibilityLabel={`Foto ${index + 1}`} />;
          if (!onPress) {
            return (
              <View key={`${uri}-${index}`} style={{ width, height }}>
                {photo}
              </View>
            );
          }
          return (
            <Pressable key={`${uri}-${index}`} accessibilityRole="button" accessibilityLabel="Abrir publicación" onPress={onPress} style={{ width, height }}>
              {photo}
            </Pressable>
          );
        })}
      </ScrollView>
      {uris.length > 1 ? (
        <View pointerEvents="none" style={styles.dots}>
          {uris.map((uri, index) => (
            <View key={`${uri}-${index}`} style={[styles.dot, index === current ? styles.dotOn : null]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  dotOn: {
    backgroundColor: '#FFFCF8',
  },
});
