import { Post, User, Comment } from '../types';
import { getCommunityPosts, savePost, updatePost, getUser, addComment } from './storageService';
import { getCommunityUsers } from './authService';

const MOCK_TEMPLATES = [
    { text: "Just finished a great study on Romans. Highly recommend digging into Chapter 8 this week!", type: 'STUDY_SHARE' },
    { text: "Praying for everyone attending the retreat this weekend. 🙏", type: 'PRAYER_REQUEST' },
    { text: "So encouraged by the message this Sunday. God is faithful!", type: 'testimony' },
    { text: "Anyone have good resources on the book of Daniel?", type: 'STUDY_SHARE' }
];

export const getFeed = async (): Promise<Post[]> => {
    let posts = getCommunityPosts();
    const users = getCommunityUsers(); // This now includes seeded mock users

    // Seed some initial posts if feed is empty
    if (posts.length === 0 && users.length > 0) {
        // Create fake posts from the users in the DB
        users.forEach((u, i) => {
            if (i < MOCK_TEMPLATES.length) {
                const newPost: Post = {
                    id: `seed-post-${i}`,
                    userId: u.id,
                    userName: u.name,
                    userAvatar: u.avatar || 'bg-gray-500',
                    content: MOCK_TEMPLATES[i].text,
                    timestamp: new Date(Date.now() - (i * 3600000 * 5)).toISOString(),
                    likes: Math.floor(Math.random() * 20),
                    isLikedByCurrentUser: false,
                    comments: [],
                    type: MOCK_TEMPLATES[i].type as any
                };
                savePost(newPost);
            }
        });
        posts = getCommunityPosts(); // Reload
    }

    return posts.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
};

export const createPost = (content: string, type: Post['type'] = 'STUDY_SHARE', studyId?: string): Post => {
    const user = getUser();
    if (!user) throw new Error("Must be logged in");

    const newPost: Post = {
        id: crypto.randomUUID(),
        userId: user.id,
        userName: user.name || user.email.split('@')[0],
        userAvatar: user.avatar || 'bg-gray-500',
        content,
        timestamp: new Date().toISOString(),
        likes: 0,
        isLikedByCurrentUser: false,
        comments: [],
        type,
        studyId
    };

    savePost(newPost);
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
    
    updatePost(updated);
    return updated;
};

export const commentOnPost = (postId: string, text: string): Post => {
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

    const updatedPost = addComment(postId, newComment);
    if (!updatedPost) throw new Error("Post not found");
    
    return updatedPost;
};
