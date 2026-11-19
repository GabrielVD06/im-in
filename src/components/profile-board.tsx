import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { GestureHandlerRootView, TouchableOpacity } from 'react-native-gesture-handler';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Dimensions, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type KeyboardEvent } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { EffortSummary } from '@/components/effort-summary';
import { PostComposer } from '@/components/post-composer';
import { CommentMark, HeartMark, ShareMark } from '@/components/post-marks';
import { PostPhotos } from '@/components/post-photos';
import { PageSwitch } from '@/components/page-switch';
import { effortFacts, ownEfforts, ownPlans, planFacts } from '@/domain/profile-feed';
import { canSeeLikes, commentLikesOf, commentsOf, COMMENT_TEXT_MAX, commentText, likesOf, POST_PHOTO_MAX, POST_TEXT_MAX, postAllowsComments, postImages, postShowsLikes, type PostComment } from '@/domain/social';
import type { Meetup } from '@/domain/meetup';
import { useFriends } from '@/state/friends-context';
import { useProfile } from '@/state/profile-context';
import { useMeetups } from '@/state/meetup-context';
import { useSocial } from '@/state/social-context';
import { space, useColors, type Palette } from '@/theme/colors';

const PAGES = [
  { id: 'fotos', label: 'Fotos' },
  { id: 'entrenos', label: 'Entrenos' },
  { id: 'salidas', label: 'Salidas' },
];

type ProfileBoardProps = {
  username: string;
  commentsOpen: boolean;
  likesPublic: boolean;
  meetups: Meetup[];
};

export function ProfileBoard({ username, commentsOpen, likesPublic, meetups }: ProfileBoardProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const gridGap = 2;
  const tile = Math.floor((width - gridGap * 2) / 3);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { profile } = useProfile();
  const social = useSocial();
  const { friends } = useFriends();
  const { remove } = useMeetups();
  const [page, setPage] = useState('fotos');
  const [composing, setComposing] = useState(false);
  const [draftUris, setDraftUris] = useState<string[]>([]);
  const [draftText, setDraftText] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [note, setNote] = useState('');
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [shareFor, setShareFor] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState('');
  const [shareKind, setShareKind] = useState<'publicación' | 'comentario'>('publicación');
  const [heldComment, setHeldComment] = useState<PostComment | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [menuView, setMenuView] = useState<'home' | 'text' | 'photos'>('home');
  const [captionDraft, setCaptionDraft] = useState('');
  const feedRef = useRef<{ scrollTo: (options: { y?: number; animated?: boolean }) => void } | null>(null);
  const jumped = useRef<string | null>(null);
  const [openEffortId, setOpenEffortId] = useState<string | null>(null);
  const commentDraft = useRef('');
  const [commentCount, setCommentCount] = useState(0);
  const [commentKey, setCommentKey] = useState(0);
  const efforts = useMemo(() => ownEfforts(meetups, username), [meetups, username]);
  const plans = useMemo(() => ownPlans(meetups, username), [meetups, username]);
  const openEffort = efforts.find((meetup) => meetup.id === openEffortId) ?? null;

  async function pickPhoto(target: 'fresh' | 'append' | number) {
    setNote('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setNote('Para publicar una foto, autoriza el acceso a tus imágenes.');
      return;
    }
    const room = target === 'fresh' ? POST_PHOTO_MAX : target === 'append' ? POST_PHOTO_MAX - draftUris.length : 1;
    if (room <= 0) {
      return;
    }
    const several = typeof target !== 'number';
    const result = await ImagePicker.launchImageLibraryAsync(
      several
        ? { mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: room, quality: 0.7 }
        : { mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.7 },
    );
    const uris = result.canceled ? [] : result.assets.map((asset) => asset.uri).filter((uri) => uri.length > 0).slice(0, room);
    if (uris.length === 0) {
      return;
    }
    if (target === 'fresh') {
      setDraftText('');
      setDraftUris(uris);
      setComposing(true);
      return;
    }
    if (target === 'append') {
      setDraftUris((current) => [...current, ...uris].slice(0, POST_PHOTO_MAX));
      setComposing(true);
      return;
    }
    setDraftUris((current) => current.map((item, index) => (index === target ? uris[0] : item)));
  }

  const removePhoto = useCallback((index: number) => {
    setDraftUris((current) => current.filter((_, item) => item !== index));
  }, []);

  const movePhoto = useCallback((from: number, to: number) => {
    setDraftUris((current) => {
      if (from === to || from < 0 || to < 0 || from >= current.length || to >= current.length) {
        return current;
      }
      const next = current.slice();
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  function closeDraft() {
    setComposing(false);
    setDraftUris([]);
    setDraftText('');
    setPublishing(false);
  }

  async function publishDraft() {
    if (draftUris.length === 0 || publishing) {
      return;
    }
    setPublishing(true);
    try {
      await social.addPost({ authorUsername: username, imageUris: draftUris, text: draftText, commentsOpen, likesPublic });
      closeDraft();
    } finally {
      setPublishing(false);
    }
  }

  function closePosts() {
    setOpenPostId(null);
    setCommentsFor(null);
    setShareFor(null);
    setShareNote('');
    setHeldComment(null);
    setMenuFor(null);
    resetComment();
    jumped.current = null;
  }

  const displayName = [profile.name, profile.lastName].filter(Boolean).join(' ') || username || 'Tú';
  const nameMark = displayName.trim().charAt(0).toUpperCase() || 'T';
  const menuPost = menuFor ? (social.posts.find((post) => post.id === menuFor) ?? null) : null;
  const menuShown = useRef(menuPost);
  if (menuPost) {
    menuShown.current = menuPost;
  }
  const sheetPost = menuPost ?? menuShown.current;

  function openMenu(id: string) {
    const post = social.posts.find((item) => item.id === id);
    setCommentsFor(null);
    setShareFor(null);
    setCaptionDraft(post?.text ?? '');
    setMenuView('home');
    setMenuFor(id);
  }

  async function saveCaption() {
    if (!menuFor) {
      return;
    }
    await social.updatePost(menuFor, { text: captionDraft });
    setMenuView('home');
  }

  function dropPhoto(index: number) {
    if (!menuPost) {
      return;
    }
    const images = postImages(menuPost);
    const next = images.filter((_, item) => item !== index);
    const finish = async () => {
      const result = await social.updatePost(menuPost.id, { imageUris: next });
      setMenuFor(null);
      if (result === 'removed' && social.posts.length <= 1) {
        closePosts();
      }
    };
    if (images.length > 1) {
      void finish();
      return;
    }
    Alert.alert('Quitar la foto', 'Es la única. La publicación se elimina.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => void finish() },
    ]);
  }

  const sendingComment = useRef(false);

  function resetComment() {
    commentDraft.current = '';
    setCommentCount(0);
    setCommentKey((key) => key + 1);
  }

  async function publishComment() {
    if (sendingComment.current) {
      return;
    }
    const post = social.posts.find((item) => item.id === commentsFor);
    const text = commentText(commentDraft.current, COMMENT_TEXT_MAX);
    if (!post || !postAllowsComments(post, commentsOpen) || !text) {
      return;
    }
    sendingComment.current = true;
    try {
      const saved = await social.addComment({ postId: post.id, username, text });
      if (saved) {
        resetComment();
      }
    } finally {
      sendingComment.current = false;
    }
  }

  const commentsPost = commentsFor ? social.posts.find((post) => post.id === commentsFor) ?? null : null;
  const postComments = commentsPost && postAllowsComments(commentsPost, commentsOpen) ? commentsOf(social.comments, commentsPost.id) : [];
  const canSend = commentDraft.current.trim().length > 0;

  return (
    <View style={styles.board}>
      <PageSwitch value={page} options={PAGES} onChange={setPage} />
      {page === 'fotos' ? (
        <View style={styles.section}>
          <Button label="Nueva publicación" onPress={() => pickPhoto('fresh')} />
          {note ? <Text style={styles.note}>{note}</Text> : null}
          {social.posts.length === 0 ? (
            <Text style={styles.empty}>Aún no hay publicaciones. Elige una foto y, si quieres, escribe un pie.</Text>
          ) : (
            <View style={[styles.grid, { width, marginLeft: -space.lg }]}>
              {social.posts.map((post) => {
                const images = postImages(post);
                return (
                  <Pressable
                    key={post.id}
                    accessibilityRole="button"
                    accessibilityLabel="Abrir publicación"
                    onPress={() => {
                      resetComment();
                      setOpenPostId(post.id);
                    }}
                    style={{ width: tile, height: tile }}>
                    {images[0] ? <Image source={{ uri: images[0] }} style={styles.tileImage} contentFit="cover" /> : null}
                    {images.length > 1 ? (
                      <View style={styles.stack}>
                        <Text style={styles.stackLabel}>{images.length}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      ) : null}
      {page === 'entrenos' ? (
        <View style={styles.section}>
          {efforts.length === 0 ? (
            <Text style={styles.empty}>Cuando termines una carrera o un rodaje y lo guardes, el resumen aparece aquí.</Text>
          ) : (
            efforts.map((meetup) => {
              const facts = effortFacts(meetup);
              return (
                <Pressable key={meetup.id} accessibilityRole="button" onPress={() => setOpenEffortId(meetup.id)} style={styles.card}>
                  <Text style={styles.cardTitle}>{facts.title}</Text>
                  <Text style={styles.cardMeta}>
                    {facts.when} · {facts.distance}
                    {facts.time ? ` · ${facts.time}` : ''}
                  </Text>
                  {facts.pace ? <Text style={styles.cardMeta}>{facts.pace}</Text> : null}
                </Pressable>
              );
            })
          )}
        </View>
      ) : null}
      {page === 'salidas' ? (
        <View style={styles.section}>
          {plans.length === 0 ? (
            <Text style={styles.empty}>Los planes que publiques, abiertos o privados, quedan en esta lista.</Text>
          ) : (
            plans.map((meetup) => {
              const facts = planFacts(meetup);
              return (
                <View key={meetup.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{facts.title}</Text>
                  <Text style={styles.cardMeta}>
                    {facts.audience} · {facts.when}
                  </Text>
                  <Text style={styles.cardMeta}>{facts.place}</Text>
                  <Text style={styles.cardBody}>{facts.summary}</Text>
                </View>
              );
            })
          )}
        </View>
      ) : null}

      <PostComposer
        visible={composing}
        images={draftUris}
        text={draftText}
        publishing={publishing}
        onChangeText={setDraftText}
        onClose={closeDraft}
        onAdd={() => pickPhoto('append')}
        onReplace={(index) => pickPhoto(index)}
        onRemove={removePhoto}
        onMove={movePhoto}
        onPublish={publishDraft}
      />

      <Modal visible={openPostId !== null} animationType="slide" onRequestClose={closePosts} statusBarTranslucent>
        <View style={[styles.postScreen, { backgroundColor: colors.paper }]}>
          <View style={{ paddingTop: insets.top }}>
            <View style={styles.postBar}>
              <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={closePosts} hitSlop={8} style={styles.back}>
                <Text style={[styles.backLabel, { color: colors.ink }]}>←</Text>
              </Pressable>
            </View>
          </View>
          <ScrollView
            ref={(node) => {
              feedRef.current = node;
            }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.postBody}>
            {social.posts.map((post) => {
              const likes = likesOf(social.likes, post.id);
              const liked = likes.some((like) => like.username === username);
              const likesPublicHere = postShowsLikes(post, likesPublic);
              const showLikes = canSeeLikes(likesPublicHere, username, post.authorUsername);
              const commentsHere = postAllowsComments(post, commentsOpen);
              const commentCount = commentsOf(social.comments, post.id).length;
              return (
                <View
                  key={post.id}
                  style={styles.postBlock}
                  onLayout={(event) => {
                    if (post.id !== openPostId || jumped.current === openPostId) {
                      return;
                    }
                    jumped.current = openPostId;
                    const y = event.nativeEvent.layout.y;
                    requestAnimationFrame(() => feedRef.current?.scrollTo({ y, animated: false }));
                  }}>
                  <View style={styles.postHead}>
                    <View style={styles.postIdentity}>
                      {profile.photoUri ? (
                        <Image source={{ uri: profile.photoUri }} style={styles.postAvatar} contentFit="cover" accessibilityLabel="Tu foto" />
                      ) : (
                        <View style={[styles.postAvatar, styles.postAvatarEmpty, { backgroundColor: colors.photo }]}>
                          <Text style={[styles.postAvatarMark, { color: colors.onPhoto }]}>{nameMark}</Text>
                        </View>
                      )}
                      <Text style={[styles.postName, { color: colors.ink }]} numberOfLines={1}>
                        {displayName}
                      </Text>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel="Ajustes de la publicación" onPress={() => openMenu(post.id)} hitSlop={8} style={styles.menuButton}>
                      <MenuMark color={colors.ink} />
                    </Pressable>
                  </View>
                  <PostPhotos uris={postImages(post)} width={width} />
                  <View style={styles.pad}>
                    <View style={styles.actions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={liked ? 'Quitar me gusta' : 'Dar me gusta'}
                        onPress={() => social.toggleLike(post.id, username)}
                        style={styles.action}>
                        <HeartMark filled={liked} color={colors.ink} />
                      </Pressable>
                      {commentsHere ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Ver comentarios"
                          onPress={() => {
                            setShareFor(null);
                            resetComment();
                            setCommentsFor(post.id);
                          }}
                          style={styles.action}>
                          <CommentMark color={colors.ink} />
                          <Text style={[styles.actionCount, { color: colors.ink }]}>{commentCount}</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Enviar a un amigo"
                        onPress={() => {
                          setCommentsFor(null);
                          setHeldComment(null);
                          setShareNote('');
                          setShareKind('publicación');
                          setShareFor(post.id);
                        }}
                        style={styles.action}>
                        <ShareMark color={colors.ink} />
                      </Pressable>
                    </View>
                    <Text style={[styles.likeLine, { color: colors.ink }]}>{showLikes ? gustaLabel(likes.length) : 'Me gusta en privado'}</Text>
                    {showLikes && !likesPublic ? <Text style={styles.cardMeta}>El número solo lo ves tú.</Text> : null}
                    {post.text ? <Text style={styles.caption}>{post.text}</Text> : null}
                    <Text style={styles.cardMeta}>{postedOn(post.createdAt)}</Text>
                    {commentsHere ? null : <Text style={styles.cardMeta}>Los comentarios están apagados.</Text>}
                  </View>
                </View>
              );
            })}
          </ScrollView>
          <SlideSheet open={commentsPost !== null} onClose={() => { resetComment(); setCommentsFor(null); }} closeLabel="Cerrar comentarios" background={colors.paper} bottomInset={insets.bottom}>
                <View style={[styles.handle, { backgroundColor: colors.line }]} />
                <Text style={[styles.commentsTitle, { color: colors.ink }]}>Comentarios</Text>
                <ScrollView style={[styles.commentsList, { maxHeight: Math.max(96, Math.min(280, height - 280)) }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  {postComments.length === 0 ? <Text style={styles.cardMeta}>Aún no hay comentarios.</Text> : null}
                  {postComments.map((item) => {
                    const marks = commentLikesOf(social.commentLikes, item.id);
                    const marked = marks.some((like) => like.username === username);
                    const body = commentText(item.text, COMMENT_TEXT_MAX);
                    return (
                      <Pressable
                        key={item.id}
                        accessibilityRole="button"
                        accessibilityHint="Mantén pulsado para borrar, copiar o compartir"
                        delayLongPress={350}
                        onLongPress={() => setHeldComment(item)}
                        style={[styles.commentBlock, { borderColor: colors.line }]}>
                        <View style={styles.commentCopy}>
                          <Text style={styles.comment}>
                            <Text style={styles.commentAuthor}>{item.username || 'Tú'}</Text> {body}
                          </Text>
                          <Text style={styles.cardMeta}>{postedOn(item.createdAt)}</Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={marked ? 'Quitar me gusta del comentario' : 'Dar me gusta al comentario'}
                          onPress={() => void social.toggleCommentLike(item.id, username)}
                          hitSlop={8}
                          style={styles.commentLike}>
                          <HeartMark filled={marked} color={colors.ink} still size={18} />
                          {marks.length > 0 ? <Text style={[styles.commentLikeCount, { color: colors.muted }]}>{marks.length}</Text> : null}
                        </Pressable>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <View style={styles.replyDock}>
                  <Text style={[styles.replyCount, { color: colors.muted }]}>
                    {commentCount}/{COMMENT_TEXT_MAX}
                  </Text>
                  <View style={styles.replyRow}>
                    <TextInput
                      key={commentKey}
                      accessibilityLabel="Comentario"
                      defaultValue=""
                      onChangeText={(next) => {
                        const line = next.replace(/[\r\n]+/g, ' ');
                        commentDraft.current = line;
                        setCommentCount(line.length);
                      }}
                      placeholder="Agrega un comentario…"
                      placeholderTextColor={colors.placeholder}
                      maxLength={COMMENT_TEXT_MAX}
                      returnKeyType="send"
                      blurOnSubmit={false}
                      onSubmitEditing={() => {
                        void publishComment();
                      }}
                      style={[styles.replyInput, { color: colors.ink, borderColor: colors.line, backgroundColor: colors.card }]}
                    />
                    <GestureHandlerRootView style={styles.sendRoot}>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Enviar comentario"
                        disabled={!canSend}
                        activeOpacity={0.85}
                        onPress={() => {
                          void publishComment();
                        }}
                        style={[styles.send, { backgroundColor: canSend ? colors.action : colors.actionSoft }]}>
                        <Text style={[styles.sendLabel, { color: canSend ? colors.onAction : colors.muted }]}>➤</Text>
                      </TouchableOpacity>
                    </GestureHandlerRootView>
                  </View>
                </View>
          </SlideSheet>
          <SlideSheet open={heldComment !== null} onClose={() => setHeldComment(null)} closeLabel="Cerrar opciones" background={colors.paper} bottomInset={insets.bottom}>
                <View style={[styles.handle, { backgroundColor: colors.line }]} />
                <Text style={[styles.commentsTitle, { color: colors.ink }]}>Comentario</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    const text = heldComment ? commentText(heldComment.text, COMMENT_TEXT_MAX) : '';
                    if (text) {
                      void Clipboard.setStringAsync(text);
                    }
                    setHeldComment(null);
                  }}
                  style={styles.menuRow}>
                  <Text style={[styles.menuLabel, { color: colors.ink }]}>Copiar</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    if (!heldComment) {
                      return;
                    }
                    setShareKind('comentario');
                    setShareNote('');
                    setShareFor(heldComment.id);
                    setHeldComment(null);
                  }}
                  style={styles.menuRow}>
                  <Text style={[styles.menuLabel, { color: colors.ink }]}>Compartir</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    if (heldComment && heldComment.username === username) {
                      void social.removeComment(heldComment.id);
                    }
                    setHeldComment(null);
                  }}
                  style={styles.menuRow}>
                  <Text style={[styles.menuLabel, { color: colors.danger }]}>Borrar</Text>
                </Pressable>
          </SlideSheet>
          <SlideSheet open={shareFor !== null} onClose={() => setShareFor(null)} closeLabel="Cerrar envío" background={colors.paper} bottomInset={insets.bottom}>
                <View style={[styles.handle, { backgroundColor: colors.line }]} />
                <Text style={[styles.commentsTitle, { color: colors.ink }]}>Enviar a un amigo</Text>
                {friends.length === 0 ? (
                  <Text style={styles.cardMeta}>Aún no hay amigos. Cuando alguien acepte, podrás enviarle {shareKind === 'comentario' ? 'el comentario' : 'la publicación'}.</Text>
                ) : (
                  friends.map((friend) => (
                    <Pressable
                      key={friend.id}
                      accessibilityRole="button"
                      onPress={() => setShareNote(friend.name)}
                      style={styles.friendSend}>
                      <Text style={[styles.commentAuthor, { color: colors.ink }]}>{friend.name}</Text>
                      <Text style={[styles.cardMeta, { color: colors.action }]}>Enviar</Text>
                    </Pressable>
                  ))
                )}
                {shareNote ? <Text style={styles.cardMeta}>Todavía no hay un chat con {shareNote}.</Text> : null}
          </SlideSheet>
          <SlideSheet open={menuPost !== null} onClose={() => setMenuFor(null)} closeLabel="Cerrar ajustes" background={colors.paper} bottomInset={insets.bottom}>
            {sheetPost ? (
              <>
                <View style={[styles.handle, { backgroundColor: colors.line }]} />
                <Text style={[styles.commentsTitle, { color: colors.ink }]}>
                  {menuView === 'text' ? 'Descripción' : menuView === 'photos' ? 'Fotos' : 'Ajustes'}
                </Text>
                {menuView === 'home' ? (
                  <View>
                    <Pressable accessibilityRole="button" onPress={() => setMenuView('text')} style={styles.menuRow}>
                      <Text style={[styles.menuLabel, { color: colors.ink }]}>Editar descripción</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => setMenuView('photos')} style={styles.menuRow}>
                      <Text style={[styles.menuLabel, { color: colors.ink }]}>Quitar una foto</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void social.updatePost(sheetPost.id, { commentsOpen: !postAllowsComments(sheetPost, commentsOpen) })}
                      style={styles.menuRow}>
                      <Text style={[styles.menuLabel, { color: colors.ink }]}>Comentarios</Text>
                      <Text style={[styles.cardMeta, { color: colors.action }]}>{postAllowsComments(sheetPost, commentsOpen) ? 'Abiertos' : 'Apagados'}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void social.updatePost(sheetPost.id, { likesPublic: !postShowsLikes(sheetPost, likesPublic) })}
                      style={styles.menuRow}>
                      <Text style={[styles.menuLabel, { color: colors.ink }]}>Me gusta</Text>
                      <Text style={[styles.cardMeta, { color: colors.action }]}>{postShowsLikes(sheetPost, likesPublic) ? 'Públicos' : 'Privados'}</Text>
                    </Pressable>
                  </View>
                ) : null}
                {menuView === 'text' ? (
                  <View style={styles.captionEdit}>
                    <TextInput
                      accessibilityLabel="Descripción"
                      value={captionDraft}
                      onChangeText={setCaptionDraft}
                      placeholder="Escribe un pie de foto…"
                      placeholderTextColor={colors.placeholder}
                      maxLength={POST_TEXT_MAX}
                      multiline
                      style={[styles.replyInput, { color: colors.ink, borderColor: colors.line, backgroundColor: colors.card }]}
                    />
                    <Text style={[styles.replyCount, { color: colors.muted }]}>
                      {captionDraft.length}/{POST_TEXT_MAX}
                    </Text>
                    <Pressable accessibilityRole="button" onPress={() => void saveCaption()} style={[styles.saveCaption, { backgroundColor: colors.action }]}>
                      <Text style={[styles.saveCaptionLabel, { color: colors.onAction }]}>Guardar</Text>
                    </Pressable>
                  </View>
                ) : null}
                {menuView === 'photos' ? (
                  <View style={styles.photoStrip}>
                    {postImages(sheetPost).map((uri, index) => (
                      <View key={`${uri}-${index}`} style={styles.photoCell}>
                        <Image source={{ uri }} style={styles.photoThumb} contentFit="cover" />
                        <Pressable accessibilityRole="button" accessibilityLabel={`Quitar foto ${index + 1}`} onPress={() => dropPhoto(index)} style={styles.photoRemove}>
                          <Text style={styles.photoRemoveLabel}>×</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}
          </SlideSheet>
        </View>
      </Modal>

      <EffortSummary
        meetup={openEffort}
        onClose={() => setOpenEffortId(null)}
        onDelete={(id) => {
          void remove(id);
          setOpenEffortId(null);
        }}
      />
    </View>
  );
}

const rise = { duration: 320, easing: Easing.out(Easing.cubic) };
const fall = { duration: 240, easing: Easing.in(Easing.cubic) };

function SlideSheet({
  open,
  onClose,
  closeLabel,
  background,
  bottomInset,
  children,
}: {
  open: boolean;
  onClose: () => void;
  closeLabel: string;
  background: string;
  bottomInset: number;
  children: ReactNode;
}) {
  const { height } = useWindowDimensions();
  const travel = useRef(height);
  travel.current = height;
  const [rendered, setRendered] = useState(open);
  const generation = useRef(0);
  const started = useRef(false);
  const shift = useSharedValue(height);
  const keys = useSharedValue(0);
  const coverH = useSharedValue(height);
  if (height > coverH.value) {
    coverH.value = height;
  }
  const dim = useSharedValue(0);
  const finish = useCallback((ticket: number) => {
    if (ticket === generation.current) {
      setRendered(false);
    }
  }, []);

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      if (!open) {
        return;
      }
    }
    const ticket = ++generation.current;
    if (open) {
      setRendered(true);
      shift.value = travel.current;
      shift.value = withTiming(0, rise);
      dim.value = withTiming(1, { duration: 220 });
      return;
    }
    const covered = keys.value;
    dim.value = withTiming(0, { duration: 180 });
    keys.value = withTiming(0, fall);
    shift.value = withTiming(travel.current + covered, fall, (done) => {
      if (done) {
        runOnJS(finish)(ticket);
      }
    });
    Keyboard.dismiss();
  }, [dim, finish, keys, open, shift]);

  useEffect(() => {
    const lift = (event: KeyboardEvent) => {
      const screenHeight = Dimensions.get('screen').height;
      const keyboardTop = event.endCoordinates.screenY;
      const fromScreen = keyboardTop > 0 ? screenHeight - keyboardTop : 0;
      const covered = Math.max(event.endCoordinates.height, fromScreen);
      keys.value = withTiming(Math.max(0, covered), { duration: 220, easing: Easing.out(Easing.cubic) });
    };
    const drop = () => {
      keys.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
    };
    const show = Keyboard.addListener('keyboardDidShow', lift);
    const hide = Keyboard.addListener('keyboardDidHide', drop);
    return () => {
      show.remove();
      hide.remove();
    };
  }, [keys]);

  const backdrop = useAnimatedStyle(() => ({ opacity: dim.value }));
  const sheet = useAnimatedStyle(() => ({
    transform: [{ translateY: shift.value - keys.value }],
    maxHeight: Math.max(220, Math.min(coverH.value * 0.78, coverH.value - keys.value - 12)),
    paddingBottom: keys.value > 0 ? 0 : Math.max(bottomInset, 12),
  }));

  if (!rendered && !open) {
    return null;
  }

  return (
    <View style={sheetChrome.cover} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[sheetChrome.backdrop, backdrop]}>
        <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} style={sheetChrome.fill} />
      </Animated.View>
      <Animated.View style={[sheetChrome.sheet, { backgroundColor: background }, sheet]}>{children}</Animated.View>
    </View>
  );
}

function MenuMark({ color }: { color: string }) {
  return (
    <View style={stylesMenu.wrap}>
      <View style={[stylesMenu.line, { backgroundColor: color }]} />
      <View style={[stylesMenu.line, { backgroundColor: color }]} />
      <View style={[stylesMenu.line, { backgroundColor: color }]} />
    </View>
  );
}

const sheetChrome = StyleSheet.create({
  cover: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  fill: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: space.lg,
    paddingTop: 10,
    gap: 8,
    overflow: 'hidden',
  },
});

const stylesMenu = StyleSheet.create({
  wrap: {
    width: 18,
    gap: 4,
  },
  line: {
    height: 1.6,
    borderRadius: 1,
  },
});

function gustaLabel(count: number) {
  if (count === 1) {
    return '1 me gusta';
  }
  return `${count} me gusta`;
}

function postedOn(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    board: {
      gap: space.sm,
    },
    section: {
      gap: space.sm,
    },
    empty: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 22,
    },
    note: {
      color: colors.action,
      fontSize: 14,
      lineHeight: 20,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 2,
    },
    tileImage: {
      width: '100%',
      height: '100%',
    },
    stack: {
      position: 'absolute',
      top: 6,
      right: 6,
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      paddingHorizontal: 6,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(17,17,17,0.72)',
    },
    stackLabel: {
      color: '#FFFCF8',
      fontSize: 12,
      fontWeight: '700',
    },
    pad: {
      paddingHorizontal: space.lg,
      gap: 8,
      paddingTop: 4,
    },
    postScreen: {
      flex: 1,
    },
    postHead: {
      minHeight: 52,
      paddingHorizontal: space.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    postIdentity: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    postAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    postAvatarEmpty: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    postAvatarMark: {
      fontSize: 14,
      fontWeight: '700',
    },
    postName: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
    },
    menuButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuRow: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    menuLabel: {
      fontSize: 16,
      fontWeight: '600',
    },
    captionEdit: {
      gap: 8,
    },
    saveCaption: {
      minHeight: 44,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveCaptionLabel: {
      fontSize: 16,
      fontWeight: '700',
    },
    photoStrip: {
      flexDirection: 'row',
      gap: 10,
    },
    photoCell: {
      width: 92,
      height: 116,
    },
    photoThumb: {
      width: 92,
      height: 116,
      borderRadius: 12,
    },
    photoRemove: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(17,17,17,0.72)',
    },
    photoRemoveLabel: {
      color: '#FFFCF8',
      fontSize: 16,
      lineHeight: 18,
    },
    postBar: {
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: space.sm,
    },
    back: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backLabel: {
      fontSize: 24,
      lineHeight: 28,
    },
    postBody: {
      paddingBottom: space.lg,
    },
    replyBar: {
      paddingHorizontal: space.lg,
      paddingTop: 8,
      gap: 4,
    },
    replyDock: {
      flexGrow: 0,
    },
    sendRoot: {
      width: 44,
      height: 44,
    },
    replyCount: {
      fontSize: 12,
      textAlign: 'right',
    },
    replyRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
    },
    replyInput: {
      flex: 1,
      minHeight: 44,
      maxHeight: 96,
      borderWidth: 1,
      borderRadius: 22,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
      fontSize: 16,
    },
    send: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendLabel: {
      fontSize: 18,
      lineHeight: 22,
    },
    card: {
      borderRadius: 20,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      padding: space.md,
      gap: 4,
    },
    cardTitle: {
      color: colors.ink,
      fontSize: 17,
      fontWeight: '700',
    },
    cardMeta: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
    },
    cardBody: {
      color: colors.ink,
      fontSize: 15,
      lineHeight: 21,
    },
    caption: {
      color: colors.ink,
      fontSize: 16,
      lineHeight: 22,
    },
    postBlock: {
      paddingBottom: space.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: -10,
    },
    action: {
      minHeight: 44,
      paddingHorizontal: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionCount: {
      fontSize: 15,
      fontWeight: '600',
      marginLeft: 4,
    },
    friendSend: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    likeLine: {
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '700',
    },
    commentsCover: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      justifyContent: 'flex-end',
    },
    commentsBackdrop: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    commentsSheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: space.lg,
      paddingTop: 10,
      gap: 8,
      maxHeight: '78%',
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
    },
    commentsTitle: {
      fontSize: 17,
      fontWeight: '700',
      textAlign: 'center',
    },
    commentsList: {
      flexGrow: 0,
      flexShrink: 1,
      maxHeight: 280,
    },
    commentBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 14,
    },
    commentCopy: {
      flex: 1,
      gap: 2,
    },
    commentLike: {
      minWidth: 28,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    commentLikeCount: {
      fontSize: 11,
      fontWeight: '600',
    },
    comment: {
      color: colors.ink,
      fontSize: 15,
      lineHeight: 21,
    },
    commentAuthor: {
      fontWeight: '700',
    },
  });
}
