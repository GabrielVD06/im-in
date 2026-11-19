import { StyleSheet, View } from 'react-native';

type Glyph = 'salidas' | 'gente' | 'entreno' | 'mensajes' | 'tu';

type TabGlyphProps = {
  name: Glyph;
  color: string;
  fill?: string;
};

export function TabGlyph({ name, color, fill }: TabGlyphProps) {
  if (name === 'entreno') {
    return (
      <View style={[styles.plus, { backgroundColor: fill ?? color }]}>
        <View style={[styles.mark, { borderColor: '#FFFCF8' }]} />
      </View>
    );
  }
  if (name === 'salidas') {
    return (
      <View style={styles.box}>
        <View style={[styles.pinHead, { borderColor: color }]} />
        <View style={[styles.pinStem, { backgroundColor: color }]} />
      </View>
    );
  }
  if (name === 'mensajes') {
    return (
      <View style={styles.box}>
        <View style={[styles.bubble, { borderColor: color }]} />
      </View>
    );
  }
  if (name === 'gente') {
    return (
      <View style={styles.box}>
        <View style={[styles.headBack, { borderColor: color }]} />
        <View style={[styles.headFront, { borderColor: color }]} />
        <View style={[styles.shoulders, { borderColor: color }]} />
      </View>
    );
  }
  return (
    <View style={styles.box}>
      <View style={[styles.personHead, { borderColor: color }]} />
      <View style={[styles.personBody, { borderColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 24,
    height: 24,
    alignItems: 'center',
  },
  roof: {
    width: 0,
    height: 0,
    marginTop: 2,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  house: {
    width: 12,
    height: 8,
    marginTop: -1,
    borderWidth: 1.6,
    borderTopWidth: 0,
  },
  headBack: {
    position: 'absolute',
    top: 3,
    right: 2,
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  headFront: {
    position: 'absolute',
    top: 2,
    left: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.6,
  },
  shoulders: {
    position: 'absolute',
    left: 2,
    bottom: 2,
    width: 14,
    height: 7,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1.6,
    borderBottomWidth: 0,
  },
  personHead: {
    width: 8,
    height: 8,
    marginTop: 2,
    borderRadius: 4,
    borderWidth: 1.6,
  },
  personBody: {
    width: 14,
    height: 7,
    marginTop: 2,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1.6,
    borderBottomWidth: 0,
  },
  plus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  pinHead: {
    width: 10,
    height: 10,
    marginTop: 2,
    borderRadius: 5,
    borderWidth: 1.6,
  },
  pinStem: {
    width: 2,
    height: 7,
    borderRadius: 1,
  },
  bubble: {
    width: 16,
    height: 12,
    marginTop: 5,
    borderWidth: 1.6,
    borderRadius: 4,
  },
});
