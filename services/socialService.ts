import { Post, User } from '../types';
import { getCommunityPosts, savePost, updatePost, getUser } from './storageService';

// Simulated "Bot" Friends
const MOCK_USERS = [
    { name: 'Pastor Mike', avatar: 'bg-blue-600' },
    { name: 'Sarah Jenkins', avatar: 'bg-pink-500' },
    { name: 'Youth Group Leader', avatar: 'bg-yellow-500' },
    { name: 'Grace Community Church', avatar: 'bg-purple-700' },
];

const MOCK_TEMPLATES = [
    { text: "Just finished a great study on Romans. Highly recommend digging into Chapter 8 this week!", type: 'STUDY_SHARE' },
    { text: "Praying for everyone attending the retreat this weekend. 🙏", type: 'PRAYER_REQUEST' },
    { text: "So encouraged by the message this Sunday. God is faithful!", type: 'testimony' },
    { text: "Anyone have good resources on the book of Daniel?", type: 'STUDY_SHARE' }
];

// Combine real posts with some fake ones to make the feed look alive
export const getFeed = async (): Promise<Post[]> => {
    const realPosts = getCommunityPosts();
    
    // In a real app, we'd fetch from API. Here we simulate 'fetching' mixed content.
    // If we have no real posts, let's generate a seed if not already present.
    // But since we persist real posts, let's just create some volatile mock posts that show up mixed in.
    
    const mockPosts: Post[] = MOCK_USERS.map((u, i) => ({
        id: `mock-${i}`,
        userId: `mock-user-${i}`,
        userName: u.name,
        userAvatar: u.avatar,
        content: MOCK_TEMPLATES[i].text,
        timestamp: new Date(Date.now() - (i * 3600000 * 5)).toISOString(), // Staggered times
        likes: Math.floor(Math.random() * 20),
        isLikedByCurrentUser: false,
        comments: [],
        type: MOCK_TEMPLATES[i].type as any
    }));

    // Merge and sort by date descending
    const feed = [...realPosts, ...mockPosts].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return feed;
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
    
    // Only save if it's a real post (not mock)
    if (!post.id.startsWith('mock-')) {
        updatePost(updated);
    }
    
    return updated;
};