import { UserSettings, SermonStudy, DEFAULT_SETTINGS, Bulletin, Post, Comment } from '../types';
import { getCurrentUser, updateUser } from './authService';
import { supabase } from './supabaseClient';

const SETTINGS_KEY_PREFIX = 'sermon_scribe_settings_';

// --- Settings ---
export const getSettings = (): UserSettings => {
  const user = getCurrentUser();
  
  // 1. Get Local Storage (Always serves as a fallback or base)
  let localSettings = DEFAULT_SETTINGS;
  try {
    const stored = user ? localStorage.getItem(SETTINGS_KEY_PREFIX + user.id) : null;
    if (stored) {
        localSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error("Error reading local settings", e);
  }

  // 2. Merge Cloud Settings if available
  // We prefer cloud values, but if cloud is missing a value (undefined/null), we keep the local value.
  // This allows us to maintain data like 'churchLocation' locally even if the DB column is missing.
  if (user?.settings) {
       return {
           studyDuration: user.settings.studyDuration ?? localSettings.studyDuration,
           studyLength: user.settings.studyLength ?? localSettings.studyLength,
           supportingReferencesCount: user.settings.supportingReferencesCount ?? localSettings.supportingReferencesCount,
           notificationTime: user.settings.notificationTime ?? localSettings.notificationTime,
           
           churchLocation: user.settings.churchLocation ?? localSettings.churchLocation,
           churchName: user.settings.churchName ?? localSettings.churchName,
           serviceTimes: user.settings.serviceTimes ?? localSettings.serviceTimes,
           
           geofenceEnabled: user.settings.geofenceEnabled ?? localSettings.geofenceEnabled,
           sundayReminderEnabled: user.settings.sundayReminderEnabled ?? localSettings.sundayReminderEnabled
       };
  }

  // 3. Fallback to local only
  return localSettings;
};

export const saveSettings = (settings: UserSettings): void => {
  const user = getCurrentUser();
  if (!user) return;
  
  // 1. Save Local (Backup/Latency/Offline support)
  localStorage.setItem(SETTINGS_KEY_PREFIX + user.id, JSON.stringify(settings));

  // 2. Save Cloud (Sync to Supabase Profile)
  const updatedUser = { ...user, settings };
  updateUser(updatedUser).catch(err => console.error("Failed to sync settings to cloud", err));
};

export { getCurrentUser as getUser, logout as logoutUser, updateUser, getUserById } from './authService';

// --- Studies (Supabase) ---
export const getStudies = async (): Promise<SermonStudy[]> => {
  if (!supabase) return [];
  const user = getCurrentUser();
  if (!user) return [];

  // Filter for items where is_archived is NOT true (false or null)
  const { data, error } = await supabase
    .from('studies')
    .select('*')
    .eq('user_id', user.id)
    .neq('is_archived', true) 
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
      isCompleted: row.is_completed,
      isArchived: row.is_archived
  }));
};

export const getStudyById = async (id: string): Promise<SermonStudy | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase
        .from('studies')
        .select('*')
        .eq('id', id)
        .single();
        
    if (error || !data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      sermonTitle: data.sermon_title,
      preacher: data.preacher,
      dateRecorded: data.date_recorded,
      originalAudioDuration: data.original_audio_duration,
      days: data.days,
      isCompleted: data.is_completed,
      isArchived: data.is_archived
    };
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
      is_completed: study.isCompleted,
      is_archived: study.isArchived || false
  };

  const { error } = await supabase.from('studies').upsert(payload);
  if (error) {
      console.error("Supabase Save Error:", error);
      throw new Error("Failed to save study to database: " + error.message);
  }
};

export const deleteStudy = async (id: string): Promise<void> => {
    if (!supabase) return;
    // Soft delete: Mark as archived instead of removing
    await supabase
        .from('studies')
        .update({ is_archived: true })
        .eq('id', id);
};

export const joinStudy = async (originalStudyId: string): Promise<void> => {
    const original = await getStudyById(originalStudyId);
    if (!original) throw new Error("Study not found");
    
    const user = getCurrentUser();
    if (!user) throw new Error("Must be logged in");

    const newStudy: SermonStudy = {
        ...original,
        id: crypto.randomUUID(),
        userId: user.id,
        isCompleted: false,
        days: original.days.map(d => ({ ...d, isCompleted: false })),
        isArchived: false
    };

    await saveStudy(newStudy);
};

// --- Bulletins ---
export const getBulletins = async (): Promise<Bulletin[]> => {
    if (!supabase) return [];
    const user = getCurrentUser();
    if (!user) return [];
    
    const { data } = await supabase
        .from('bulletins')
        .select('*')
        .eq('user_id', user.id) // Filter by user
        .order('created_at', { ascending: false });
        
    if (!data) return [];
    
    return data.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        dateScanned: row.date_scanned,
        title: row.title,
        events: row.events,
        rawSummary: row.raw_summary
    }));
};

export const saveBulletin = async (bulletin: Bulletin): Promise<void> => {
    if (!supabase) return;
    const user = getCurrentUser();
    if (!user) throw new Error("User required to save bulletin");
    
    const payload = {
        id: bulletin.id,
        user_id: user.id,
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
    // RLS should handle user check, but good practice to allow delete
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

    const { data: postsData } = await supabase
        .from('posts')
        .select(`
            *,
            comments (*)
        `)
        .order('created_at', { ascending: false });

    if (!postsData) return [];

    // Fetch related study details efficiently
    const studyIds = postsData
        .map((p: any) => p.study_id)
        .filter((id: any) => id); // Filter valid IDs
    
    const studyMap: Record<string, {title: string, preacher: string}> = {};

    if (studyIds.length > 0) {
        // We attempt to fetch titles for these studies. 
        // Note: RLS might prevent seeing details of some studies if not public, 
        // but typically shared studies should be accessible or title mirrored.
        const { data: studiesData } = await supabase
            .from('studies')
            .select('id, sermon_title, preacher')
            .in('id', studyIds);
            
        if (studiesData) {
            studiesData.forEach((s: any) => {
                studyMap[s.id] = { title: s.sermon_title, preacher: s.preacher };
            });
        }
    }

    const user = getCurrentUser();

    return postsData.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        userName: row.user_name,
        userAvatar: row.user_avatar,
        content: row.content,
        type: row.type,
        study_id: row.study_id,
        studyId: row.study_id,
        studyData: studyMap[row.study_id],
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