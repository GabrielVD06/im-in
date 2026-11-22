import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ProfileBoard } from '@/components/profile-board';
import { isRouteSport } from '@/domain/meetup';
import { SportMark } from '@/components/sport-marks';
import { displayCity } from '@/domain/cities';
import { isAdultAccount, levelName, sportName } from '@/domain/profile';
import { routeMark } from '@/domain/route-goals';
import { useFriends } from '@/state/friends-context';
import { useMeetups } from '@/state/meetup-context';
import { useProfile } from '@/state/profile-context';
import { space, useColors, type Palette } from '@/theme/colors';

export default function TuScreen() {
  const { profile } = useProfile();
  const city = displayCity(profile.city);
  const { meetups } = useMeetups();
  const { friends } = useFriends();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const fullName = [profile.name, profile.lastName].filter(Boolean).join(' ');
  const initials = [profile.name, profile.lastName]
    .map((part) => part.trim().charAt(0))
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={styles.frame}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.top}>
          <Text style={styles.topTitle}>Perfil</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={() => router.push('/datos' as Href)} style={styles.settings}>
              <Text style={styles.settingsLabel}>Datos</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push('/ajustes')} style={styles.settings}>
              <Text style={styles.settingsLabel}>Ajustes</Text>
            </Pressable>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.identity}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}>
                {profile.photoUri ? (
                  <Image source={{ uri: profile.photoUri }} style={styles.photo} contentFit="cover" accessibilityLabel="Tu foto" />
                ) : (
                  <Text style={styles.initials}>{initials || 'Tú'}</Text>
                )}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Editar perfil" onPress={() => router.push('/editar' as Href)} style={styles.pencil}>
                <Text style={styles.pencilLabel}>✎</Text>
              </Pressable>
            </View>
            <Text style={styles.name}>{fullName || 'Tu perfil'}</Text>
            <Text style={styles.city}>{city}</Text>
            {isAdultAccount(profile) ? null : <Text style={styles.city}>Tu perfil es privado hasta los 18.</Text>}
            <Pressable accessibilityRole="button" accessibilityLabel="Ver amigos" onPress={() => setFriendsOpen(true)} style={styles.friendsStat}>
              <Text style={styles.friendsCount}>{friends.length}</Text>
              <Text style={styles.friendsLabel}>{friends.length === 1 ? 'amigo' : 'amigos'}</Text>
            </Pressable>
            {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
          </View>
          {profile.sports.length > 0 ? (
            <View style={styles.badges}>
              {profile.sports.map((sport) => {
                const detail = isRouteSport(sport.sportId) ? routeMark(meetups, sport.sportId).label : levelName(sport.level);
                return (
                  <View key={sport.sportId} style={styles.badge}>
                    <SportMark sport={sport.sportId} size={28} />
                    <Text style={styles.badgeName}>{sportName(sport.sportId)}</Text>
                    {detail ? <Text style={styles.badgeDetail}>{detail}</Text> : null}
                  </View>
                );
              })}
            </View>
          ) : null}
          <ProfileBoard username={profile.username} commentsOpen={profile.commentsOpen} likesPublic={profile.likesPublic} meetups={meetups} />
        </ScrollView>
      </SafeAreaView>
      <Modal visible={friendsOpen} transparent animationType="slide" onRequestClose={() => setFriendsOpen(false)}>
        <View style={styles.modal}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar amigos" onPress={() => setFriendsOpen(false)} style={styles.backdrop} />
          <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.panelHandle} />
            <Text style={styles.panelTitle}>Amigos</Text>
            <Text style={styles.panelCount}>{friends.length === 1 ? '1 amigo' : `${friends.length} amigos`}</Text>
            {friends.length === 0 ? (
              <Text style={styles.panelEmpty}>Aún no hay amigos. Cuando alguien acepte, aparece aquí y desde su fila abres el chat.</Text>
            ) : (
              <ScrollView style={styles.friendList} showsVerticalScrollIndicator={false}>
                {friends.map((friend) => {
                  const letters = friend.name
                    .split(' ')
                    .map((part) => part.trim().charAt(0))
                    .filter(Boolean)
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();
                  return (
                    <View key={friend.id} style={styles.friendRow}>
                      <View style={styles.friendAvatar}>
                        <Text style={styles.friendInitials}>{letters || '·'}</Text>
                      </View>
                      <Text style={styles.friendName} numberOfLines={1}>
                        {friend.name}
                      </Text>
                      <Button
                        size="compact"
                        label="Abrir chat"
                        onPress={() => {
                          setFriendsOpen(false);
                          router.push('/mensajes');
                        }}
                      />
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    frame: {
      flex: 1,
      backgroundColor: colors.paper,
      alignItems: 'center',
    },
    safe: {
      flex: 1,
      width: '100%',
      maxWidth: 480,
      backgroundColor: colors.paper,
    },
    top: {
      minHeight: 52,
      paddingHorizontal: space.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    topTitle: {
      color: colors.ink,
      fontSize: 20,
      fontWeight: '600',
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    settings: {
      minHeight: 36,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.card,
      paddingHorizontal: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    settingsLabel: {
      color: colors.ink,
      fontSize: 14,
      fontWeight: '600',
    },
    scroll: {
      paddingHorizontal: space.lg,
      paddingBottom: space.xl,
      gap: space.md,
    },
    identity: {
      alignItems: 'center',
      paddingTop: space.sm,
      gap: 4,
    },
    avatarWrap: {
      width: 120,
      height: 120,
      marginBottom: space.sm,
    },
    avatar: {
      width: 108,
      height: 108,
      borderRadius: 54,
      overflow: 'hidden',
      backgroundColor: colors.photo,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photo: {
      width: '100%',
      height: '100%',
    },
    initials: {
      color: colors.onPhoto,
      fontSize: 32,
      fontWeight: '600',
    },
    pencil: {
      position: 'absolute',
      right: 0,
      bottom: 4,
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pencilLabel: {
      color: colors.ink,
      fontSize: 18,
      lineHeight: 22,
    },
    name: {
      color: colors.ink,
      fontSize: 22,
      fontWeight: '600',
    },
    city: {
      color: colors.muted,
      fontSize: 14,
      textAlign: 'center',
    },
    friendsStat: {
      alignItems: 'center',
      marginTop: 8,
      minWidth: 72,
    },
    friendsCount: {
      color: colors.ink,
      fontSize: 18,
      fontWeight: '700',
    },
    friendsLabel: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '600',
    },
    modal: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    panel: {
      maxHeight: '72%',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      backgroundColor: colors.paper,
      paddingHorizontal: space.lg,
      paddingTop: 10,
      gap: 8,
    },
    panelHandle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.line,
      marginBottom: 4,
    },
    panelTitle: {
      color: colors.ink,
      fontSize: 22,
      fontWeight: '700',
    },
    panelCount: {
      color: colors.muted,
      fontSize: 14,
    },
    panelEmpty: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 22,
      paddingBottom: 12,
    },
    friendList: {
      flexGrow: 0,
    },
    friendRow: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    friendAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.photo,
      alignItems: 'center',
      justifyContent: 'center',
    },
    friendInitials: {
      color: colors.onPhoto,
      fontSize: 15,
      fontWeight: '700',
    },
    friendName: {
      flex: 1,
      color: colors.ink,
      fontSize: 16,
      fontWeight: '600',
    },
    bio: {
      color: colors.ink,
      fontSize: 15,
      lineHeight: 21,
      textAlign: 'center',
      marginTop: 4,
    },
    badges: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 8,
    },
    badge: {
      minWidth: 112,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.card,
      paddingHorizontal: 14,
      paddingVertical: 10,
      alignItems: 'center',
      gap: 2,
    },
    badgeName: {
      color: colors.ink,
      fontSize: 15,
      fontWeight: '700',
    },
    badgeDetail: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 16,
      textAlign: 'center',
    },
  });
}
