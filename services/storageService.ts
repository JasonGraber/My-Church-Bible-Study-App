
import { UserSettings, SermonStudy, DEFAULT_SETTINGS, Bulletin, Post, Comment } from '../types';
import { getCurrentUser, updateUser, ensureValidSession } from './authService';
import { supabase } from './supabaseClient';

const SETTINGS_KEY_PREFIX = 'sermon_scribe_settings_';
const STUDIES_KEY_PREFIX = 'sermon_scribe_studies_v2_'; 
const BULLETINS_KEY_PREFIX = 'sermon_scribe_bulletins_v3_'; // Version bump for reliability

// --- Local Helpers ---
const getLocalStudies = (userId: string): SermonStudy[] => {
    try {
        const stored = localStorage.getItem(STUDIES_KEY_PREFIX + userId);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error("Local storage read error:", e);
        return [];
    }
};

const saveLocalStudy = (userId: string, study: SermonStudy) => {
    try {
        const studies = getLocalStudies(userId);
        const index = studies.findIndex(s => s.id === study.id);
        if (index >= 0) {
            studies[index] = study;
        } else {
            studies.unshift(study);
        }
        localStorage.setItem(STUDIES_KEY_PREFIX + userId, JSON.stringify(studies));
    } catch (e) {
        console.error("Local storage write error:", e);
    }
};

const getLocalBulletins = (userId: string): Bulletin[] => {
    try {
        const stored = localStorage.getItem(BULLETINS_KEY_PREFIX + userId);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error("Local bulletins read error:", e);
        return [];
    }
};

const saveLocalBulletin = (userId: string, bulletin: Bulletin) => {
    try {
        const bulletins = getLocalBulletins(userId);
        const index = bulletins.findIndex(b => b.id === bulletin.id);
        if (index >= 0) {
            bulletins[index] = bulletin;
        } else {
            bulletins.unshift(bulletin);
        }
        localStorage.setItem(BULLETINS_KEY_PREFIX + userId, JSON.stringify(bulletins));
    } catch (e) {
        console.error("Local bulletins write error:", e);
    }
};

// --- Settings ---
export const getSettings = (): UserSettings => {
  try {
      const user = getCurrentUser();
      let localSettings = DEFAULT_SETTINGS;
      try {
        const stored = user ? localStorage.getItem(SETTINGS_KEY_PREFIX + user.id) : null;
        if (stored) {
            localSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
        }
      } catch (e) {
        localSettings = DEFAULT_SETTINGS;
      }

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
      return localSettings;
  } catch (err) {
      return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (settings: UserSettings): void => {
  const user = getCurrentUser();
  if (!user) return;
  
  try {
      localStorage.setItem(SETTINGS_KEY_PREFIX + user.id, JSON.stringify(settings));
      const updatedUser = { ...user, settings };
      updateUser(updatedUser).catch(err => console.error("Failed to sync settings", err));
  } catch (e) {
      console.error("Failed to save settings", e);
  }
};

export { getCurrentUser as getUser, logout as logoutUser, updateUser, getUserById } from './authService';

// --- Mapping ---
const mapStudyFromDB = (row: any): SermonStudy => ({
  id: row.id,
  userId: row.user_id,
  sermonTitle: row.sermon_title,
  preacher: row.preacher,
  dateRecorded: row.date_recorded,
  originalAudioDuration: row.original_audio_duration,
  days: row.days || [],
  isCompleted: row.is_completed,
  isArchived: row.is_archived || false
});

const mapBulletinFromDB = (row: any): Bulletin => ({
    id: row.id,
    userId: row.user_id,
    dateScanned: row.date_scanned,
    title: row.title,
    events: row.events || [],
    rawSummary: row.raw_summary
});

// --- Studies (Local First) ---
export const getStudies = async (): Promise<SermonStudy[]> => {
  const user = getCurrentUser();
  if (!user) return [];

  const local = getLocalStudies(user.id).filter(s => !s.isArchived);
  
  if (supabase) {
    (async () => {
        try {
            const { data, error } = await supabase
              .from('studies')
              .select('*')
              .eq('user_id', user.id)
              .neq('is_archived', true)
              .order('created_at', { ascending: false });

            if (!error && data) {
                const cloudStudies = data.map(mapStudyFromDB);
                localStorage.setItem(STUDIES_KEY_PREFIX + user.id, JSON.stringify(cloudStudies));
            }
        } catch (e) {
            console.warn("Background studies sync failed:", e);
        }
    })();
  }
  
  return local;
};

export const saveStudy = async (study: SermonStudy): Promise<void> => {
  const user = getCurrentUser();
  if (!user) throw new Error("User required");

  saveLocalStudy(user.id, study);

  if (!supabase) return;

  try {
      await ensureValidSession();
      
      const payload: any = {
          id: study.id,
          user_id: user.id,
          sermon_title: study.sermonTitle,
          preacher: study.preacher,
          date_recorded: study.dateRecorded,
          original_audio_duration: study.originalAudioDuration,
          days: study.days,
          is_completed: study.isCompleted,
          is_archived: study.isArchived || false
      };

      const cloudSavePromise = supabase.from('studies').upsert(payload);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Database Timeout")), 10000));
      
      await Promise.race([cloudSavePromise, timeoutPromise]);
  } catch (err) {
      console.warn("Cloud study sync failed:", err);
  }
};

export const deleteStudy = async (id: string): Promise<void> => {
    const user = getCurrentUser();
    if (!user) return;
    const studies = getLocalStudies(user.id).map(s => s.id === id ? { ...s, isArchived: true } : s);
    localStorage.setItem(STUDIES_KEY_PREFIX + user.id, JSON.stringify(studies));
    if (supabase) await supabase.from('studies').update({ is_archived: true }).eq('id', id);
};

export const getStudyById = async (id: string): Promise<SermonStudy | null> => {
    const user = getCurrentUser();
    if (user) {
        const local = getLocalStudies(user.id).find(s => s.id === id);
        if (local) return local;
    }
    if (!supabase) return null;
    const { data } = await supabase.from('studies').select('*').eq('id', id).single();
    return data ? mapStudyFromDB(data) : null;
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

// --- Bulletins (Local First) ---
export const getBulletins = async (): Promise<Bulletin[]> => {
    const user = getCurrentUser();
    if (!user) return [];
    
    // 1. Return Local immediately
    const local = getLocalBulletins(user.id);

    // 2. Sync from Cloud in background
    if (supabase) {
        (async () => {
            try {
                const { data, error } = await supabase
                    .from('bulletins')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (!error && data) {
                    const cloudBulletins = data.map(mapBulletinFromDB);
                    localStorage.setItem(BULLETINS_KEY_PREFIX + user.id, JSON.stringify(cloudBulletins));
                }
            } catch (e) {
                console.warn("Background bulletins sync failed:", e);
            }
        })();
    }
    
    return local;
};

export const saveBulletin = async (bulletin: Bulletin): Promise<void> => {
    const user = getCurrentUser();
    if (!user) return;
    
    // 1. Save Locally
    saveLocalBulletin(user.id, bulletin);

    // 2. Sync to Cloud
    if (!supabase) return;

    try {
        await ensureValidSession();
        
        const payload = { 
            id: bulletin.id, 
            user_id: user.id, 
            title: bulletin.title, 
            date_scanned: bulletin.dateScanned, 
            raw_summary: bulletin.rawSummary, 
            events: bulletin.events 
        };

        const cloudSavePromise = supabase.from('bulletins').upsert(payload);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Database Timeout")), 10000));
        
        await Promise.race([cloudSavePromise, timeoutPromise]);
    } catch (err) {
        console.warn("Cloud bulletin sync failed:", err);
    }
};

export const deleteBulletin = async (id: string): Promise<void> => {
    const user = getCurrentUser();
    if (!user) return;
    const current = getLocalBulletins(user.id).filter(b => b.id !== id);
    localStorage.setItem(BULLETINS_KEY_PREFIX + user.id, JSON.stringify(current));
    if (supabase) await supabase.from('bulletins').delete().eq('id', id);
};

export const deleteEvent = async (eventId: string): Promise<void> => {
    const user = getCurrentUser();
    if (!user) return;
    
    const bulletins = getLocalBulletins(user.id);
    let affectedBulletin: Bulletin | null = null;
    
    const newBulletins = bulletins.map(b => {
        const initialCount = b.events.length;
        const newEvents = b.events.filter(e => e.id !== eventId);
        if (newEvents.length !== initialCount) {
            affectedBulletin = { ...b, events: newEvents };
            return affectedBulletin;
        }
        return b;
    });

    if (affectedBulletin) {
        localStorage.setItem(BULLETINS_KEY_PREFIX + user.id, JSON.stringify(newBulletins));
        if (supabase) {
            await supabase.from('bulletins').update({ events: affectedBulletin.events }).eq('id', affectedBulletin.id);
        }
    }
};

export const syncLocalDataToCloud = async (): Promise<{ studies: number; bulletins: number }> => {
    const user = getCurrentUser();
    if (!user || !supabase) return { studies: 0, bulletins: 0 };

    const localStudies = getLocalStudies(user.id);
    const localBulletins = getLocalBulletins(user.id);

    let studiesCount = 0;
    let bulletinsCount = 0;

    for (const study of localStudies) {
        try {
            await saveStudy(study);
            studiesCount++;
        } catch (e) { console.error("Sync study error", e); }
    }

    for (const bulletin of localBulletins) {
        try {
            await saveBulletin(bulletin);
            bulletinsCount++;
        } catch (e) { console.error("Sync bulletin error", e); }
    }

    return { studies: studiesCount, bulletins: bulletinsCount };
};

// --- Social ---
export const getCommunityPosts = async (): Promise<Post[]> => {
    if (!supabase) return [];
    try {
        const { data: postsData } = await supabase.from('posts').select('*, comments (*)').order('created_at', { ascending: false }).limit(20);
        if (!postsData) return [];
        const user = getCurrentUser();
        return postsData.map((row: any) => ({
            id: row.id,
            userId: row.user_id,
            userName: row.user_name,
            userAvatar: row.user_avatar,
            content: row.content,
            type: row.type,
            studyId: row.study_id,
            studyData: row.study_data,
            timestamp: row.created_at,
            likes: row.likes || 0,
            isLikedByCurrentUser: (row.liked_by_users || []).includes(user?.id),
            comments: (row.comments || []).map((c: any) => ({ id: c.id, userId: c.user_id, userName: c.user_name, userAvatar: c.user_avatar, text: c.text, timestamp: c.created_at }))
        }));
    } catch (e) { return []; }
};

export const getPostsByUserId = async (userId: string): Promise<Post[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('posts').select('*').eq('user_id', userId);
    return data || [];
};

export const savePost = async (post: Post): Promise<void> => {
    if (!supabase) return;
    await supabase.from('posts').upsert({ id: post.id, user_id: post.userId, user_name: post.userName, user_avatar: post.userAvatar, content: post.content, type: post.type, study_id: post.studyId, study_data: post.studyData, created_at: post.timestamp });
};

export const updatePost = async (post: Post): Promise<void> => {
    if (!supabase) return;
    const user = getCurrentUser();
    await supabase.from('posts').update({ likes: post.likes, liked_by_users: post.isLikedByCurrentUser ? [user?.id] : [] }).eq('id', post.id);
};

export const addComment = async (postId: string, comment: Comment): Promise<void> => {
    if (!supabase) return;
    await supabase.from('comments').insert({ id: comment.id, post_id: postId, user_id: comment.userId, user_name: comment.userName, user_avatar: comment.userAvatar, text: comment.text, created_at: comment.timestamp });
};
