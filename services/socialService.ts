
import { Post, User, Comment } from '../types';
import { getCommunityPosts, savePost, updatePost, getUser, addComment, getStudyById } from './storageService';
import { getCommunityUsers } from './authService';

export const getFeed = async (): Promise<Post[]> => {
    const posts = await getCommunityPosts();
    // No mocks needed for live DB
    return posts.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
};

export const createPost = async (content: string, type: Post['type'] = 'STUDY_SHARE', studyId?: string): Promise<Post> => {
    const user = getUser();
    if (!user) throw new Error("Must be logged in");

    let studyData;
    if (studyId) {
        try {
            const study = await getStudyById(studyId);
            if (study) {
                studyData = { title: study.sermonTitle, preacher: study.preacher };
            }
        } catch (e) {
            console.warn("Could not fetch study for snapshot", e);
        }
    }

    const newPost: Post = {
        id: crypto.randomUUID(), // Will be overwritten by DB ID usually, but safe for optimisic
        userId: user.id,
        userName: user.name || user.email.split('@')[0],
        userAvatar: user.avatar || 'bg-gray-500',
        content,
        timestamp: new Date().toISOString(),
        likes: 0,
        isLikedByCurrentUser: false,
        comments: [],
        type,
        studyId,
        studyData
    };

    await savePost(newPost);
    return newPost;
};

export const toggleLikePost = (post: Post): Post => {
    const updated = { ...post };
    if (updated.isLikedByCurrentUser) {
        updated.likes--;
        updated.isLikedByCurrentUser = false;
    } else {
        updated.likes++;
        updated.isLikedByCurrentUser = true;
    }
    
    // Fire and forget update
    updatePost(updated);
    return updated;
};

export const commentOnPost = async (postId: string, text: string): Promise<Post> => {
    const user = getUser();
    if (!user) throw new Error("Must be logged in");

    const newComment: Comment = {
        id: crypto.randomUUID(),
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar,
        text,
        timestamp: new Date().toISOString()
    };

    await addComment(postId, newComment);
    
    // Re-fetch the feed to get the updated post with the new comment from the DB.
    const updatedFeed = await getFeed();
    const updatedPost = updatedFeed.find(p => p.id === postId);

    if (!updatedPost) {
         throw new Error("Post not found after commenting.");
    }

    return updatedPost;
};
