
import { UserSettings, SermonStudy, DEFAULT_SETTINGS, Bulletin, Post, Comment } from '../types';
import { getCurrentUser, updateUser } from './authService';
import { supabase } from './supabaseClient';

const SETTINGS_KEY_PREFIX = 'sermon_scribe_settings_';

// --- Settings (Keep Local for Speed/Simplicity or move to Profile) ---
// For now, let's keep settings local to device as they are often device-specific (like Permissions)
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

export { getCurrentUser as getUser, logout as logoutUser, updateUser, getUserById } from './authService';

// --- Studies (Supabase) ---
export const getStudies = async (): Promise<SermonStudy[]> => {
  if (!supabase) return [];
  const user = getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('studies')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  // Map snake_case to camelCase
  return data.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      sermonTitle: row.sermon_title,
      preacher: row.preacher,
      dateRecorded: row.date_recorded,
      originalAudioDuration: row.original_audio_duration,
      days: row.days,
      isCompleted: row.is_completed
  }));
};

export const saveStudy = async (study: SermonStudy): Promise<void> => {
  if (!supabase) return;
  const user = getCurrentUser();
  if (!user) throw new Error("User must be logged in to save study.");

  const payload = {
      id: study.id, // upsert uses ID
      user_id: user.id,
      sermon_title: study.sermonTitle,
      preacher: study.preacher,
      date_recorded: study.dateRecorded,
      original_audio_duration: study.originalAudioDuration,
      days: study.days,
      is_completed: study.isCompleted
  };

  const { error } = await supabase.from('studies').upsert(payload);
  if (error) {
      console.error("Supabase Save Error:", error);
      throw new Error("Failed to save study to database: " + error.message);
  }
};

export const deleteStudy = async (id: string): Promise<void> => {
    if (!supabase) return;
    await supabase.from('studies').delete().eq('id', id);
};

// --- Bulletins ---
export const getBulletins = async (): Promise<Bulletin[]> => {
    if (!supabase) return [];
    
    const { data } = await supabase
        .from('bulletins')
        .select('*')
        .order('created_at', { ascending: false });
        
    if (!data) return [];
    
    return data.map((row: any) => ({
        id: row.id,
        dateScanned: row.date_scanned,
        title: row.title,
        events: row.events,
        rawSummary: row.raw_summary
    }));
};

export const saveBulletin = async (bulletin: Bulletin): Promise<void> => {
    if (!supabase) return;
    
    const payload = {
        id: bulletin.id,
        title: bulletin.title,
        date_scanned: bulletin.dateScanned,
        raw_summary: bulletin.rawSummary,
        events: bulletin.events
    };
    
    const { error } = await supabase.from('bulletins').upsert(payload);
    if (error) throw error;
};

export const deleteBulletin = async (id: string): Promise<void> => {
    if (!supabase) return;
    await supabase.from('bulletins').delete().eq('id', id);
};

export const deleteEvent = async (eventId: string): Promise<void> => {
    // This is trickier with JSONB. For simplicity in this demo, 
    // we fetch all, modify memory, save back. 
    // Real implementation should use Postgres jsonb functions or normalized tables.
    const bulletins = await getBulletins();
    for (const b of bulletins) {
        if (b.events.some(e => e.id === eventId)) {
            const updatedEvents = b.events.filter(e => e.id !== eventId);
            await saveBulletin({ ...b, events: updatedEvents });
        }
    }
};


// --- Community ---
export const getCommunityPosts = async (): Promise<Post[]> => {
    if (!supabase) return [];

    const { data } = await supabase
        .from('posts')
        .select(`
            *,
            comments (*)
        `)
        .order('created_at', { ascending: false });

    if (!data) return [];
    const user = getCurrentUser();

    return data.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        userName: row.user_name,
        userAvatar: row.user_avatar,
        content: row.content,
        type: row.type,
        studyId: row.study_id,
        timestamp: row.created_at,
        likes: row.likes || 0,
        isLikedByCurrentUser: (row.liked_by_users || []).includes(user?.id),
        comments: (row.comments || []).map((c: any) => ({
            id: c.id,
            userId: c.user_id,
            userName: c.user_name,
            userAvatar: c.user_avatar,
            text: c.text,
            timestamp: c.created_at
        }))
    }));
};

export const getPostsByUserId = async (userId: string): Promise<Post[]> => {
    const all = await getCommunityPosts();
    return all.filter(p => p.userId === userId);
};

export const savePost = async (post: Post): Promise<void> => {
    if (!supabase) return;
    
    const payload = {
        id: post.id,
        user_id: post.userId,
        user_name: post.userName,
        user_avatar: post.userAvatar,
        content: post.content,
        type: post.type,
        study_id: post.studyId,
        created_at: post.timestamp
    };
    
    const { error } = await supabase.from('posts').upsert(payload);
    if (error) throw error;
};

export const updatePost = async (post: Post): Promise<void> => {
    if (!supabase) return;
    const user = getCurrentUser();
    
    await supabase.from('posts').update({
        likes: post.likes,
        liked_by_users: post.isLikedByCurrentUser ? [user?.id] : [] // Simplified for demo
    }).eq('id', post.id);
};

export const addComment = async (postId: string, comment: Comment): Promise<Post | null> => {
    if (!supabase) return null;
    
    await supabase.from('comments').insert({
        id: comment.id,
        post_id: postId,
        user_id: comment.userId,
        user_name: comment.userName,
        user_avatar: comment.userAvatar,
        text: comment.text,
        created_at: comment.timestamp
    });
    
    // Return placeholder, caller will likely reload feed
    return null; 
};
