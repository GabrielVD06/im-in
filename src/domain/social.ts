export const POST_TEXT_MAX = 280;
export const POST_PHOTO_MAX = 3;
export const COMMENT_TEXT_MAX = 200;

export type PhotoPost = {
  id: string;
  authorUsername: string;
  imageUri: string;
  imageUris: string[];
  text: string;
  createdAt: string;
  commentsOpen?: boolean;
  likesPublic?: boolean;
};

export function postAllowsComments(post: PhotoPost, accountOpen: boolean) {
  return typeof post.commentsOpen === 'boolean' ? post.commentsOpen : accountOpen;
}

export function postShowsLikes(post: PhotoPost, accountPublic: boolean) {
  return typeof post.likesPublic === 'boolean' ? post.likesPublic : accountPublic;
}

export function postImages(post: { imageUri?: string; imageUris?: string[] }) {
  const listed = Array.isArray(post.imageUris) ? post.imageUris.filter((uri) => typeof uri === 'string' && uri.length > 0) : [];
  const images = listed.length > 0 ? listed : post.imageUri ? [post.imageUri] : [];
  return images.slice(0, POST_PHOTO_MAX);
}

export type PostLike = {
  postId: string;
  username: string;
};

export type PostComment = {
  id: string;
  postId: string;
  username: string;
  text: string;
  createdAt: string;
};

export type CommentLike = {
  commentId: string;
  username: string;
};

export function cleanText(value: string, max: number) {
  return value.trim().slice(0, max);
}

export function commentText(value: string, max: number) {
  return value.replace(/[\r\n]+/g, ' ').replace(/[ \t]{2,}/g, ' ').trim().slice(0, max);
}

export function canSeeLikes(likesPublic: boolean, viewer: string, author: string) {
  return likesPublic || viewer === author;
}

export function likesOf(likes: PostLike[], postId: string) {
  return likes.filter((like) => like.postId === postId);
}

export function commentsOf(comments: PostComment[], postId: string) {
  return comments.filter((comment) => comment.postId === postId);
}

export function commentLikesOf(likes: CommentLike[], commentId: string) {
  return likes.filter((like) => like.commentId === commentId);
}

export function toggleCommentLike(likes: CommentLike[], commentId: string, username: string) {
  const mine = likes.some((like) => like.commentId === commentId && like.username === username);
  if (mine) {
    return likes.filter((like) => like.commentId !== commentId || like.username !== username);
  }
  return [...likes, { commentId, username }];
}

export function toggleLike(likes: PostLike[], postId: string, username: string) {
  const mine = likes.some((like) => like.postId === postId && like.username === username);
  if (mine) {
    return likes.filter((like) => like.postId !== postId || like.username !== username);
  }
  return [...likes, { postId, username }];
}

export function isPhotoPost(value: unknown): value is PhotoPost {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const post = value as PhotoPost;
  return typeof post.id === 'string' && postImages(post).length > 0 && typeof post.authorUsername === 'string' && typeof post.createdAt === 'string';
}

export function isPostLike(value: unknown): value is PostLike {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const like = value as PostLike;
  return typeof like.postId === 'string' && typeof like.username === 'string';
}

export function isCommentLike(value: unknown): value is CommentLike {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const like = value as CommentLike;
  return typeof like.commentId === 'string' && typeof like.username === 'string';
}

export function isPostComment(value: unknown): value is PostComment {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const comment = value as PostComment;
  return typeof comment.id === 'string' && typeof comment.postId === 'string' && typeof comment.username === 'string' && typeof comment.text === 'string';
}
