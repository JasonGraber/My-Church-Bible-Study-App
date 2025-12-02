
import { UserSettings, SermonStudy, DEFAULT_SETTINGS, User, Bulletin, Post, Comment } from '../types';
import { getCurrentUser } from './authService';

const SETTINGS_KEY_PREFIX = 'sermon_scribe_settings_';
const STUDIES_KEY = 'sermon_scribe_studies'; // We will store all studies here, filtered by userId
const BULLETINS_KEY = 'sermon_scribe_bulletins';
const POSTS_KEY = 'sermon_scribe_posts';

// --- User Management (Delegated to Auth Service mostly) ---
export { getCurrentUser as getUser, logout as logoutUser, updateUser, getUserById } from './authService';

// --- Settings (Scoped by User) ---
export const getSettings = (): UserSettings => {
  const user = getCurrentUser();
  if (!user) return DEFAULT_SETTINGS;

  try {
    const stored = localStorage.getItem(SETTINGS_KEY_PREFIX + user.id);
    if (!stored) return DEFAULT_SETTINGS;
    
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (settings: UserSettings): void => {
  const user = getCurrentUser();
  if (!user) return;
  localStorage.setItem(SETTINGS_KEY_PREFIX + user.id, JSON.stringify(settings));
};

// --- Studies (Multi-tenant) ---
export const getStudies = (userId?: string): SermonStudy[] => {
  try {
    const stored = localStorage.getItem(STUDIES_KEY);
    const allStudies: SermonStudy[] = stored ? JSON.parse(stored) : [];
    
    // Filter by specific user or current user
    const targetId = userId || getCurrentUser()?.id;
    if (!targetId) return [];

    return allStudies.filter(s => s.userId === targetId);
  } catch (e) {
    return [];
  }
};

export const saveStudy = (study: SermonStudy): void => {
  try {
    const stored = localStorage.getItem(STUDIES_KEY);
    let allStudies: SermonStudy[] = stored ? JSON.parse(stored) : [];
    
    // Ensure study has owner
    if (!study.userId) {
        const user = getCurrentUser();
        if (user) study.userId = user.id;
    }

    const index = allStudies.findIndex(s => s.id === study.id);
    if (index >= 0) {
      allStudies[index] = study;
    } else {
      allStudies.unshift(study);
    }
    localStorage.setItem(STUDIES_KEY, JSON.stringify(allStudies));
  } catch (e) {
      console.error("Save failed", e);
  }
};

export const deleteStudy = (id: string): void => {
  const stored = localStorage.getItem(STUDIES_KEY);
  let allStudies: SermonStudy[] = stored ? JSON.parse(stored) : [];
  allStudies = allStudies.filter(s => s.id !== id);
  localStorage.setItem(STUDIES_KEY, JSON.stringify(allStudies));
};

export const getStudyById = (id: string): SermonStudy | undefined => {
    // Can access any study by ID (simulating public share if needed, though strictly we might restrict)
    const stored = localStorage.getItem(STUDIES_KEY);
    const allStudies: SermonStudy[] = stored ? JSON.parse(stored) : [];
    return allStudies.find(s => s.id === id);
};

// --- Bulletins (Shared or User Scoped? Let's make them global for the church for now) ---
export const getBulletins = (): Bulletin[] => {
  try {
    const stored = localStorage.getItem(BULLETINS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

export const saveBulletin = (bulletin: Bulletin): void => {
  const items = getBulletins();
  
  const allExistingEvents = items.flatMap(b => b.events);
  const uniqueEvents = bulletin.events.filter(newEvent => {
      const isDuplicate = allExistingEvents.some(existing => {
          const titleA = (existing.title || "").toLowerCase().trim();
          const titleB = (newEvent.title || "").toLowerCase().trim();
          const dateA = existing.date;
          return titleA === titleB && dateA === existing.date;
      });
      return !isDuplicate;
  });

  const dedupedBulletin = { ...bulletin, events: uniqueEvents };
  items.unshift(dedupedBulletin);
  localStorage.setItem(BULLETINS_KEY, JSON.stringify(items));
};

export const deleteBulletin = (id: string): void => {
  const items = getBulletins().filter(b => b.id !== id);
  localStorage.setItem(BULLETINS_KEY, JSON.stringify(items));
};

export const deleteEvent = (eventId: string): void => {
  const bulletins = getBulletins();
  const updatedBulletins = bulletins.map(bulletin => ({
    ...bulletin,
    events: bulletin.events.filter(e => e.id !== eventId)
  }));
  localStorage.setItem(BULLETINS_KEY, JSON.stringify(updatedBulletins));
};

// --- Community Posts ---

export const getCommunityPosts = (): Post[] => {
    try {
        const stored = localStorage.getItem(POSTS_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch(e) {
        return [];
    }
}

export const getPostsByUserId = (userId: string): Post[] => {
    try {
        const allPosts = getCommunityPosts();
        return allPosts.filter(p => p.userId === userId).sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
    } catch(e) {
        return [];
    }
}

export const savePost = (post: Post): void => {
    const posts = getCommunityPosts();
    posts.unshift(post);
    localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
}

export const updatePost = (post: Post): void => {
    const posts = getCommunityPosts();
    const idx = posts.findIndex(p => p.id === post.id);
    if (idx >= 0) {
        posts[idx] = post;
        localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
    }
}

export const addComment = (postId: string, comment: Comment): Post | null => {
    const posts = getCommunityPosts();
    const idx = posts.findIndex(p => p.id === postId);
    if (idx === -1) return null;

    const post = posts[idx];
    post.comments = post.comments || [];
    post.comments.push(comment);
    
    posts[idx] = post;
    localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
    return post;
}
