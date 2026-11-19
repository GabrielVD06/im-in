import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  cleanText,
  commentText,
  COMMENT_TEXT_MAX,
  isCommentLike,
  isPhotoPost,
  isPostComment,
  isPostLike,
  POST_PHOTO_MAX,
  POST_TEXT_MAX,
  postImages,
  toggleCommentLike,
  toggleLike,
  type PhotoPost,
  type CommentLike,
  type PostComment,
  type PostLike,
} from '@/domain/social';

const STORAGE_KEY = 'salida.social.v1';

type SocialRecord = {
  posts: PhotoPost[];
  likes: PostLike[];
  comments: PostComment[];
  commentLikes: CommentLike[];
};

type SocialContextValue = SocialRecord & {
  ready: boolean;
  addPost: (input: { authorUsername: string; imageUris: string[]; text: string; commentsOpen?: boolean; likesPublic?: boolean }) => Promise<void>;
  updatePost: (id: string, patch: { text?: string; imageUris?: string[]; commentsOpen?: boolean; likesPublic?: boolean }) => Promise<'saved' | 'removed' | 'missing'>;
  toggleLike: (postId: string, username: string) => Promise<void>;
  toggleCommentLike: (commentId: string, username: string) => Promise<void>;
  removeComment: (id: string) => Promise<void>;
  addComment: (input: { postId: string; username: string; text: string }) => Promise<boolean>;
  clear: () => Promise<void>;
};

const EMPTY: SocialRecord = { posts: [], likes: [], comments: [], commentLikes: [] };

const SocialContext = createContext<SocialContextValue | null>(null);

function readRecord(value: unknown): SocialRecord {
  if (!value || typeof value !== 'object') {
    return EMPTY;
  }
  const record = value as SocialRecord;
  return {
    posts: Array.isArray(record.posts)
      ? record.posts.filter(isPhotoPost).map((post) => {
          const imageUris = postImages(post);
          return { ...post, imageUri: imageUris[0], imageUris, text: cleanText(post.text ?? '', POST_TEXT_MAX) };
        })
      : [],
    likes: Array.isArray(record.likes) ? record.likes.filter(isPostLike) : [],
    comments: Array.isArray(record.comments) ? record.comments.filter(isPostComment) : [],
    commentLikes: Array.isArray(record.commentLikes) ? record.commentLikes.filter(isCommentLike) : [],
  };
}

export function SocialProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [record, setRecord] = useState<SocialRecord>(EMPTY);
  const recordRef = useRef(record);
  recordRef.current = record;

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active || !raw) {
          return;
        }
        setRecord(readRecord(JSON.parse(raw) as unknown));
      })
      .catch(() => {
        // A broken social archive should not block the profile.
      })
      .finally(() => {
        if (active) {
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<SocialContextValue>(() => {
    async function persist(next: SocialRecord) {
      recordRef.current = next;
      setRecord(next);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }

    return {
      ready,
      posts: record.posts,
      likes: record.likes,
      comments: record.comments,
      commentLikes: record.commentLikes,
      async addPost(input) {
        const imageUris = input.imageUris.filter((uri) => uri.trim().length > 0).slice(0, POST_PHOTO_MAX);
        if (imageUris.length === 0) {
          return;
        }
        const post: PhotoPost = {
          id: `${Date.now()}`,
          authorUsername: input.authorUsername,
          imageUri: imageUris[0],
          imageUris,
          text: cleanText(input.text, POST_TEXT_MAX),
          createdAt: new Date().toISOString(),
          commentsOpen: input.commentsOpen !== false,
          likesPublic: input.likesPublic !== false,
        };
        await persist({ ...recordRef.current, posts: [post, ...recordRef.current.posts] });
      },
      async updatePost(id, patch) {
        const current = recordRef.current;
        const target = current.posts.find((post) => post.id === id);
        if (!target) {
          return 'missing';
        }
        const imageUris = patch.imageUris ? patch.imageUris.filter((uri) => uri.length > 0).slice(0, POST_PHOTO_MAX) : postImages(target);
        if (imageUris.length === 0) {
          const removedComments = new Set(current.comments.filter((item) => item.postId === id).map((item) => item.id));
          await persist({
            posts: current.posts.filter((post) => post.id !== id),
            likes: current.likes.filter((like) => like.postId !== id),
            comments: current.comments.filter((item) => item.postId !== id),
            commentLikes: current.commentLikes.filter((like) => !removedComments.has(like.commentId)),
          });
          return 'removed';
        }
        const next: PhotoPost = {
          ...target,
          text: patch.text !== undefined ? cleanText(patch.text, POST_TEXT_MAX) : target.text,
          imageUris,
          imageUri: imageUris[0],
          ...(patch.commentsOpen !== undefined ? { commentsOpen: patch.commentsOpen } : {}),
          ...(patch.likesPublic !== undefined ? { likesPublic: patch.likesPublic } : {}),
        };
        await persist({ ...current, posts: current.posts.map((post) => (post.id === id ? next : post)) });
        return 'saved';
      },
      async toggleLike(postId, username) {
        await persist({ ...recordRef.current, likes: toggleLike(recordRef.current.likes, postId, username) });
      },
      async toggleCommentLike(commentId, username) {
        await persist({ ...recordRef.current, commentLikes: toggleCommentLike(recordRef.current.commentLikes, commentId, username) });
      },
      async removeComment(id) {
        const current = recordRef.current;
        await persist({
          ...current,
          comments: current.comments.filter((item) => item.id !== id),
          commentLikes: current.commentLikes.filter((like) => like.commentId !== id),
        });
      },
      async addComment(input) {
        const text = commentText(input.text, COMMENT_TEXT_MAX);
        if (!text) {
          return false;
        }
        const comment: PostComment = {
          id: `${Date.now()}`,
          postId: input.postId,
          username: input.username,
          text,
          createdAt: new Date().toISOString(),
        };
        await persist({ ...recordRef.current, comments: [...recordRef.current.comments, comment] });
        return true;
      },
      async clear() {
        recordRef.current = EMPTY;
        setRecord(EMPTY);
        await AsyncStorage.removeItem(STORAGE_KEY);
      },
    };
  }, [ready, record]);

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial() {
  const value = useContext(SocialContext);
  if (!value) {
    throw new Error('useSocial debe usarse dentro de SocialProvider');
  }
  return value;
}
