import { Image } from 'expo-image';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { POST_PHOTO_MAX, POST_TEXT_MAX } from '@/domain/social';
import { space, useColors, type Palette } from '@/theme/colors';

type PostComposerProps = {
  visible: boolean;
  images: string[];
  text: string;
  publishing: boolean;
  onChangeText: (value: string) => void;
  onClose: () => void;
  onAdd: () => void;
  onReplace: (index: number) => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onPublish: () => void;
};

export function PostComposer({ visible, images, text, publishing, onChangeText, onClose, onAdd, onReplace, onRemove, onMove, onPublish }: PostComposerProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [menuIndex, setMenuIndex] = useState<number | null>(null);
  const gap = 10;
  const slots = Math.max(1, Math.min(POST_PHOTO_MAX, images.length + (images.length < POST_PHOTO_MAX ? 1 : 0)));
  const cardWidth = Math.min(148, Math.floor((width - space.lg * 2 - gap * (slots - 1)) / slots));
  const cardHeight = Math.round((cardWidth * 5) / 4);
  const canPublish = images.length > 0 && !publishing;

  const requestClose = () => {
    if (!text.trim()) {
      onClose();
      return;
    }
    Alert.alert('Descartar publicación', 'Se pierde el texto que escribiste.', [
      { text: 'Seguir editando', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: onClose },
    ]);
  };

  const countLabel = `${images.length}/${POST_PHOTO_MAX}`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={requestClose} statusBarTranslucent>
      <GestureHandlerRootView style={styles.fill}>
        <KeyboardAvoidingView style={[styles.fill, { backgroundColor: colors.paper }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ paddingTop: insets.top }}>
            <View style={styles.bar}>
              <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={requestClose} style={styles.side} hitSlop={8}>
                <Text style={[styles.sideLabel, { color: colors.ink }]}>Cerrar</Text>
              </Pressable>
              <View pointerEvents="none" style={styles.titleWrap}>
                <Text style={[styles.title, { color: colors.ink }]}>Nueva publicación</Text>
                <Text style={[styles.countMark, { color: colors.muted }]}>{countLabel}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Publicar" disabled={!canPublish} onPress={onPublish} style={[styles.side, styles.sideEnd]} hitSlop={8}>
                <Text style={[styles.publish, { color: canPublish ? colors.action : colors.muted }]}>{publishing ? 'Publicando…' : 'Publicar'}</Text>
              </Pressable>
            </View>
          </View>
          <View style={[styles.rule, { backgroundColor: colors.line }]} />
          <View style={styles.stage}>
            <PhotoStrip
              images={images}
              cardWidth={cardWidth}
              cardHeight={cardHeight}
              gap={gap}
              menuIndex={menuIndex}
              onToggleMenu={(index) => setMenuIndex((current) => (current === index ? null : index))}
              onDismissMenu={() => setMenuIndex(null)}
              onMove={(from, to) => {
                setMenuIndex(null);
                onMove(from, to);
              }}
            />
            {images.length < POST_PHOTO_MAX ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Agregar foto"
                onPress={() => {
                  setMenuIndex(null);
                  onAdd();
                }}
                style={[styles.addCard, { width: cardWidth, height: cardHeight, backgroundColor: colors.actionSoft }]}>
                <Text style={[styles.addMark, { color: colors.action }]}>+</Text>
                <Text style={[styles.addLabel, { color: colors.action }]}>Agregar</Text>
              </Pressable>
            ) : null}
          </View>
          {menuIndex !== null && images[menuIndex] ? (
            <View style={styles.choices}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  const index = menuIndex;
                  setMenuIndex(null);
                  onReplace(index);
                }}
                style={[styles.choice, { backgroundColor: colors.card }]}>
                <Text style={[styles.choiceLabel, { color: colors.action }]}>Cambiar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  const index = menuIndex;
                  setMenuIndex(null);
                  onRemove(index);
                }}
                style={[styles.choice, { backgroundColor: colors.card }]}>
                <Text style={[styles.choiceLabel, { color: colors.danger }]}>Quitar</Text>
              </Pressable>
            </View>
          ) : images.length > 1 ? (
            <Text style={[styles.hint, { color: colors.muted }]}>Mantén una foto y arrástrala para cambiar el orden.</Text>
          ) : (
            <View style={styles.hintSpace} />
          )}
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 28 }} style={styles.captionScroll}>
            <View style={[styles.rule, { backgroundColor: colors.line }]} />
            <TextInput
              accessibilityLabel="Pie de foto"
              value={text}
              onChangeText={onChangeText}
              placeholder="Escribe un pie de foto…"
              placeholderTextColor={colors.placeholder}
              multiline
              maxLength={POST_TEXT_MAX}
              textAlignVertical="top"
              style={[styles.caption, { color: colors.ink }]}
            />
            <Text style={[styles.count, { color: colors.muted }]}>
              {text.length} / {POST_TEXT_MAX}
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

function PhotoStrip({
  images,
  cardWidth,
  cardHeight,
  gap,
  menuIndex,
  onToggleMenu,
  onDismissMenu,
  onMove,
}: {
  images: string[];
  cardWidth: number;
  cardHeight: number;
  gap: number;
  menuIndex: number | null;
  onToggleMenu: (index: number) => void;
  onDismissMenu: () => void;
  onMove: (from: number, to: number) => void;
}) {
  const colors = useColors();
  const dragIndex = useSharedValue(-1);
  const dragX = useSharedValue(0);
  const slot = cardWidth + gap;
  const moveRef = useRef(onMove);
  const dismissRef = useRef(onDismissMenu);
  moveRef.current = onMove;
  dismissRef.current = onDismissMenu;
  const move = useCallback((from: number, to: number) => moveRef.current(from, to), []);
  const dismiss = useCallback(() => dismissRef.current(), []);

  return (
    <>
      {images.map((uri, index) => (
        <PhotoCard
          key={`${uri}-${index}`}
          uri={uri}
          index={index}
          count={images.length}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
          slot={slot}
          selected={menuIndex === index}
          dragIndex={dragIndex}
          dragX={dragX}
          paper={colors.paper}
          ink={colors.ink}
          line={colors.line}
          onToggleMenu={onToggleMenu}
          onDismissMenu={dismiss}
          onMove={move}
        />
      ))}
    </>
  );
}

function PhotoCard({
  uri,
  index,
  count,
  cardWidth,
  cardHeight,
  slot,
  selected,
  dragIndex,
  dragX,
  paper,
  ink,
  line,
  onToggleMenu,
  onDismissMenu,
  onMove,
}: {
  uri: string;
  index: number;
  count: number;
  cardWidth: number;
  cardHeight: number;
  slot: number;
  selected: boolean;
  dragIndex: { value: number };
  dragX: { value: number };
  paper: string;
  ink: string;
  line: string;
  onToggleMenu: (index: number) => void;
  onDismissMenu: () => void;
  onMove: (from: number, to: number) => void;
}) {
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(count > 1)
        .activateAfterLongPress(280)
        .onStart(() => {
          dragIndex.value = index;
          dragX.value = 0;
          runOnJS(onDismissMenu)();
        })
        .onUpdate((event) => {
          dragX.value = event.translationX;
        })
        .onEnd(() => {
          const shift = Math.round(dragX.value / slot);
          const next = Math.max(0, Math.min(count - 1, index + shift));
          dragIndex.value = -1;
          dragX.value = 0;
          if (next !== index) {
            runOnJS(onMove)(index, next);
          }
        })
        .onFinalize(() => {
          dragIndex.value = -1;
          dragX.value = 0;
        }),
    [count, dragIndex, dragX, index, onDismissMenu, onMove, slot],
  );

  const animated = useAnimatedStyle(() => {
    const from = dragIndex.value;
    if (from < 0) {
      return { transform: [{ translateX: 0 }, { scale: 1 }], zIndex: 0 };
    }
    const shift = Math.round(dragX.value / slot);
    const target = Math.max(0, Math.min(count - 1, from + shift));
    if (index === from) {
      return { transform: [{ translateX: dragX.value }, { scale: 1.04 }], zIndex: 3 };
    }
    let offset = 0;
    if (target > from && index > from && index <= target) {
      offset = -slot;
    } else if (target < from && index < from && index >= target) {
      offset = slot;
    }
    return { transform: [{ translateX: offset }, { scale: 1 }], zIndex: 0 };
  });

  return (
    <Animated.View style={[{ width: cardWidth, height: cardHeight }, animated]}>
      <GestureDetector gesture={pan}>
        <Animated.View>
          <Image source={{ uri }} style={[stylesCard.photo, { width: cardWidth, height: cardHeight, borderColor: selected ? ink : 'transparent' }]} contentFit="cover" accessibilityLabel={`Foto ${index + 1}`} />
        </Animated.View>
      </GestureDetector>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Opciones de la foto ${index + 1}`}
        onPress={() => onToggleMenu(index)}
        hitSlop={6}
        style={[stylesCard.mark, { backgroundColor: paper, borderColor: line }]}>
        <Text style={[stylesCard.markLabel, { color: ink }]}>×</Text>
      </Pressable>
    </Animated.View>
  );
}

const stylesCard = StyleSheet.create({
  photo: {
    borderRadius: 16,
    borderWidth: 2,
  },
  mark: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markLabel: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '500',
  },
});

function createStyles(colors: Palette) {
  return StyleSheet.create({
    fill: {
      flex: 1,
      backgroundColor: colors.paper,
    },
    bar: {
      minHeight: 58,
      paddingHorizontal: space.sm,
      paddingBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    side: {
      minWidth: 96,
      minHeight: 40,
      justifyContent: 'center',
      zIndex: 1,
    },
    sideEnd: {
      alignItems: 'flex-end',
    },
    sideLabel: {
      fontSize: 16,
    },
    titleWrap: {
      position: 'absolute',
      left: 100,
      right: 100,
      top: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
    },
    countMark: {
      fontSize: 13,
      fontWeight: '700',
      marginTop: 1,
    },
    publish: {
      fontSize: 16,
      fontWeight: '700',
    },
    rule: {
      height: StyleSheet.hairlineWidth,
    },
    stage: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingTop: space.lg,
      paddingHorizontal: space.lg,
    },
    addCard: {
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    addMark: {
      fontSize: 28,
      lineHeight: 30,
      fontWeight: '500',
    },
    addLabel: {
      fontSize: 13,
      fontWeight: '700',
    },
    choices: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 10,
      paddingTop: space.sm,
      paddingHorizontal: space.lg,
    },
    choice: {
      minHeight: 40,
      paddingHorizontal: 18,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    choiceLabel: {
      fontSize: 15,
      fontWeight: '700',
    },
    hint: {
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
      paddingTop: space.sm,
      paddingHorizontal: space.lg,
    },
    hintSpace: {
      height: space.sm,
    },
    captionScroll: {
      flex: 1,
      marginTop: space.sm,
    },
    caption: {
      minHeight: 120,
      paddingHorizontal: space.lg,
      paddingTop: space.lg,
      paddingBottom: space.sm,
      fontSize: 17,
      lineHeight: 24,
    },
    count: {
      paddingHorizontal: space.lg,
      fontSize: 13,
      textAlign: 'right',
    },
  });
}
