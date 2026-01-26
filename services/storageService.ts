
import { UserSettings, SermonStudy, DEFAULT_SETTINGS, Bulletin, Post, Comment, StudyParticipant, StudyDayComment } from '../types';
import { getCurrentUser, updateUser, ensureValidSession } from './authService';
import { supabase } from './supabaseClient';

const SETTINGS_KEY_PREFIX = 'sermon_scribe_settings_';
const STUDIES_KEY_PREFIX = 'sermon_scribe_studies_v2_'; 
const BULLETINS_KEY_PREFIX = 'sermon_scribe_bulletins_v3_';

// --- Local Helpers ---
const getLocalStudies = (userId: string): SermonStudy[] => {
    try {
        const stored = localStorage.getItem(STUDIES_KEY_PREFIX + userId);
        const parsed = stored ? JSON.parse(stored) : [];
        return Array.isArray(parsed) ? parsed : [];
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
        const parsed = stored ? JSON.parse(stored) : [];
        return Array.isArray(parsed) ? parsed : [];
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

// --- Mapping (Defensive Patterns) ---
const mapStudyFromDB = (row: any): SermonStudy => ({
  id: row.id,
  userId: row.user_id,
  sermonTitle: row.sermon_title || "Untitled Sermon",
  preacher: row.preacher || "Unknown Speaker",
  dateRecorded: row.date_recorded || new Date().toISOString(),
  originalAudioDuration: row.original_audio_duration || 0,
  days: Array.isArray(row.days) ? row.days : [],
  isCompleted: !!row.is_completed,
  isArchived: !!row.is_archived
});

const mapBulletinFromDB = (row: any): Bulletin => ({
    id: row.id,
    userId: row.user_id,
    dateScanned: row.date_scanned || new Date().toISOString(),
    title: row.title || "Untitled Bulletin",
    events: Array.isArray(row.events) ? row.events : [],
    rawSummary: row.raw_summary || ""
});

const mapPostFromDB = (row: any): Post => {
    const me = getCurrentUser();
    let studyData = row.study_data;
    if (typeof studyData === 'string') {
        try { studyData = JSON.parse(studyData); } catch(e) { studyData = undefined; }
    }
    
    return {
        id: row.id,
        userId: row.user_id,
        userName: row.user_name || "Community Member",
        userAvatar: row.user_avatar,
        content: row.content || "",
        timestamp: row.created_at || new Date().toISOString(),
        likes: row.likes || 0,
        isLikedByCurrentUser: Array.isArray(row.liked_by_users) && me ? row.liked_by_users.includes(me.id) : false,
        comments: (Array.isArray(row.comments) ? row.comments : []).map((c: any) => ({
            id: c.id,
            userId: c.user_id,
            userName: c.user_name || "Member",
            userAvatar: c.user_avatar,
            text: c.text || "",
            timestamp: c.created_at || new Date().toISOString()
        })).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
        type: row.type || 'STUDY_SHARE',
        studyId: row.study_id,
        studyData: studyData
    };
};

// --- Studies ---
export const getStudies = async (): Promise<SermonStudy[]> => {
  const user = getCurrentUser();
  if (!user) return [];

  if (supabase) {
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
            return cloudStudies;
        }
    } catch (e) {
        console.warn("Cloud studies fetch failed, falling back to local:", e);
    }
  }
  
  return getLocalStudies(user.id).filter(s => !s.isArchived);
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

      const { error } = await supabase.from('studies').upsert(payload);
      if (error) console.warn("Study cloud sync error:", error.message);
  } catch (err) {
      console.warn("Cloud study sync deferred:", err);
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
    try {
        const { data } = await supabase.from('studies').select('*').eq('id', id).maybeSingle();
        return data ? mapStudyFromDB(data) : null;
    } catch (e) {
        return null;
    }
};

export const joinStudy = async (originalStudyId: string): Promise<void> => {
    const original = await getStudyById(originalStudyId);
    if (!original) throw new Error("Study not found in cloud. The author may not have synced it yet.");
    const user = getCurrentUser();
    if (!user) throw new Error("Must be logged in");

    // Try to add as participant (Study Together feature)
    if (supabase) {
        try {
            // Check if already a participant
            const { data: existing } = await supabase
                .from('study_participants')
                .select('id')
                .eq('study_id', originalStudyId)
                .eq('user_id', user.id)
                .maybeSingle();

            if (existing) {
                throw new Error("You've already joined this study!");
            }

            // Add as participant
            const { error } = await supabase
                .from('study_participants')
                .insert({
                    study_id: originalStudyId,
                    user_id: user.id,
                    user_name: user.name,
                    user_avatar: user.avatar
                });

            if (!error) {
                return; // Successfully joined as participant
            }
            console.warn("Failed to add participant, falling back to copy:", error);
        } catch (e: any) {
            // Table might not exist yet, fall back to copy
            console.warn("Participant table error, falling back to copy:", e.message);
        }
    }

    // Fallback: Copy the study (works even without Study Together tables)
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
    const user = getCurrentUser();
    if (!user) return [];
    
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('bulletins')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (!error && data) {
                const cloudBulletins = data.map(mapBulletinFromDB);
                localStorage.setItem(BULLETINS_KEY_PREFIX + user.id, JSON.stringify(cloudBulletins));
                return cloudBulletins;
            }
        } catch (e) {
            console.warn("Cloud bulletins fetch failed, falling back to local:", e);
        }
    }
    
    return getLocalBulletins(user.id);
};

export const saveBulletin = async (bulletin: Bulletin): Promise<void> => {
    const user = getCurrentUser();
    if (!user) return;
    
    saveLocalBulletin(user.id, bulletin);

    if (!supabase) return;

    (async () => {
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
            await supabase.from('bulletins').upsert(payload);
        } catch (err) {
            console.warn("Cloud bulletin sync error:", err);
        }
    })();
};

export const deleteBulletin = async (id: string): Promise<void> => {
    const user = getCurrentUser();
    if (!user) return;
    const bulletins = getLocalBulletins(user.id).filter(b => b.id !== id);
    localStorage.setItem(BULLETINS_KEY_PREFIX + user.id, JSON.stringify(bulletins));
    if (supabase) await supabase.from('bulletins').delete().eq('id', id);
};

export const deleteEvent = async (eventId: string): Promise<void> => {
    const user = getCurrentUser();
    if (!user) return;
    const bulletins = getLocalBulletins(user.id);
    
    for (const b of bulletins) {
        const index = (b.events || []).findIndex(e => e.id === eventId);
        if (index !== -1) {
            const updatedEvents = b.events.filter(e => e.id !== eventId);
            const updatedBulletin = { ...b, events: updatedEvents };
            saveLocalBulletin(user.id, updatedBulletin);
            if (supabase) {
                await supabase.from('bulletins').update({ events: updatedEvents }).eq('id', b.id);
            }
            break;
        }
    }
};

export const syncLocalDataToCloud = async (): Promise<{studies: number, bulletins: number}> => {
    const user = getCurrentUser();
    if (!user || !supabase) return { studies: 0, bulletins: 0 };
    
    const localStudies = getLocalStudies(user.id);
    const localBulletins = getLocalBulletins(user.id);
    
    let studyCount = 0;
    let bulletinCount = 0;

    for (const study of localStudies) {
        const payload = {
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
        const { error } = await supabase.from('studies').upsert(payload);
        if (!error) studyCount++;
    }

    for (const bulletin of localBulletins) {
        const payload = {
            id: bulletin.id,
            user_id: user.id,
            title: bulletin.title,
            date_scanned: bulletin.dateScanned,
            raw_summary: bulletin.rawSummary,
            events: bulletin.events
        };
        const { error } = await supabase.from('bulletins').upsert(payload);
        if (!error) bulletinCount++;
    }
    
    return { studies: studyCount, bulletins: bulletinCount };
};

// --- Community ---
export const getCommunityPosts = async (): Promise<Post[]> => {
    if (!supabase) return [];
    try {
        const { data, error } = await supabase
            .from('posts')
            .select('*, comments(*)')
            .order('created_at', { ascending: false });
        
        if (!error && data) {
            return data.map(mapPostFromDB);
        }

        const { data: fallbackData, error: fallbackError } = await supabase
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (fallbackError || !fallbackData) return [];
        return fallbackData.map(mapPostFromDB);
    } catch (e) {
        return [];
    }
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
        study_data: post.studyData,
        likes: post.likes,
        liked_by_users: post.isLikedByCurrentUser ? [post.userId] : []
    };
    const { error } = await supabase.from('posts').upsert(payload);
    
    if (error) {
        if (error.message.includes('column "study_data" of relation "posts" does not exist') || error.message.includes('schema cache')) {
            throw new Error("Database schema out of sync. Please go to Settings and run the Supabase Migration Tool SQL to fix social features.");
        }
        throw error;
    }
};

export const updatePost = async (post: Post): Promise<void> => {
    if (!supabase) return;
    const user = getCurrentUser();
    if (!user) return;

    try {
        const { data } = await supabase.from('posts').select('liked_by_users').eq('id', post.id).maybeSingle();
        let likedBy = Array.isArray(data?.liked_by_users) ? data.liked_by_users : [];
        
        if (post.isLikedByCurrentUser) {
            if (!likedBy.includes(user.id)) likedBy.push(user.id);
        } else {
            likedBy = likedBy.filter((id: string) => id !== user.id);
        }

        await supabase.from('posts').update({ 
            likes: likedBy.length,
            liked_by_users: likedBy 
        }).eq('id', post.id);
    } catch (e) {
        console.warn("Post like update failed", e);
    }
};

export const addComment = async (postId: string, comment: Comment): Promise<void> => {
    if (!supabase) return;
    const payload = {
        id: comment.id,
        post_id: postId,
        user_id: comment.userId,
        user_name: comment.userName,
        user_avatar: comment.userAvatar,
        text: comment.text
    };
    await supabase.from('comments').insert(payload);
};

export const getPostsByUserId = async (userId: string): Promise<Post[]> => {
    if (!supabase) return [];
    try {
        const { data } = await supabase
            .from('posts')
            .select('*, comments(*)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (!data) return [];
        return data.map(mapPostFromDB);
    } catch (e) {
        return [];
    }
};

// --- Study Together Functions ---

export const getStudyParticipants = async (studyId: string): Promise<StudyParticipant[]> => {
    if (!supabase) return [];
    try {
        // Get participants
        const { data: participants, error: pError } = await supabase
            .from('study_participants')
            .select('*')
            .eq('study_id', studyId)
            .order('joined_at', { ascending: true });

        if (pError || !participants) return [];

        // Get progress for all participants
        const { data: progress } = await supabase
            .from('study_day_progress')
            .select('user_id, day_number')
            .eq('study_id', studyId);

        // Map progress to participants
        const progressMap: Record<string, number[]> = {};
        (progress || []).forEach((p: any) => {
            if (!progressMap[p.user_id]) progressMap[p.user_id] = [];
            progressMap[p.user_id].push(p.day_number);
        });

        return participants.map((p: any) => ({
            id: p.id,
            studyId: p.study_id,
            userId: p.user_id,
            userName: p.user_name || 'Unknown',
            userAvatar: p.user_avatar,
            joinedAt: p.joined_at,
            completedDays: progressMap[p.user_id] || []
        }));
    } catch (e) {
        console.error("Failed to get study participants:", e);
        return [];
    }
};

export const markStudyDayComplete = async (studyId: string, dayNumber: number): Promise<void> => {
    const user = getCurrentUser();
    if (!user || !supabase) return;

    try {
        // Check if already completed
        const { data: existing } = await supabase
            .from('study_day_progress')
            .select('id')
            .eq('study_id', studyId)
            .eq('user_id', user.id)
            .eq('day_number', dayNumber)
            .maybeSingle();

        if (!existing) {
            await supabase
                .from('study_day_progress')
                .insert({
                    study_id: studyId,
                    user_id: user.id,
                    day_number: dayNumber
                });
        }
    } catch (e) {
        console.warn("Failed to mark day complete:", e);
    }
};

export const unmarkStudyDayComplete = async (studyId: string, dayNumber: number): Promise<void> => {
    const user = getCurrentUser();
    if (!user || !supabase) return;

    try {
        await supabase
            .from('study_day_progress')
            .delete()
            .eq('study_id', studyId)
            .eq('user_id', user.id)
            .eq('day_number', dayNumber);
    } catch (e) {
        console.warn("Failed to unmark day:", e);
    }
};

export const getStudyDayComments = async (studyId: string, dayNumber: number): Promise<StudyDayComment[]> => {
    if (!supabase) return [];
    try {
        const { data, error } = await supabase
            .from('study_day_comments')
            .select('*')
            .eq('study_id', studyId)
            .eq('day_number', dayNumber)
            .order('created_at', { ascending: true });

        if (error || !data) return [];

        return data.map((c: any) => ({
            id: c.id,
            studyId: c.study_id,
            userId: c.user_id,
            userName: c.user_name || 'Unknown',
            userAvatar: c.user_avatar,
            dayNumber: c.day_number,
            comment: c.comment,
            createdAt: c.created_at
        }));
    } catch (e) {
        return [];
    }
};

export const addStudyDayComment = async (
    studyId: string,
    dayNumber: number,
    comment: string,
    studyTitle: string,
    postToFeed: boolean = true
): Promise<StudyDayComment | null> => {
    const user = getCurrentUser();
    if (!user || !supabase) return null;

    try {
        let postId: string | null = null;

        // Optionally post to community feed
        if (postToFeed) {
            const feedPost: Post = {
                id: crypto.randomUUID(),
                userId: user.id,
                userName: user.name,
                userAvatar: user.avatar,
                content: `Day ${dayNumber} reflection on "${studyTitle}": ${comment}`,
                timestamp: new Date().toISOString(),
                likes: 0,
                isLikedByCurrentUser: false,
                comments: [],
                type: 'STUDY_SHARE',
                studyId: studyId,
                studyData: { title: studyTitle }
            };
            await savePost(feedPost);
            postId = feedPost.id;
        }

        // Save day comment
        const { data, error } = await supabase
            .from('study_day_comments')
            .insert({
                study_id: studyId,
                user_id: user.id,
                user_name: user.name,
                user_avatar: user.avatar,
                day_number: dayNumber,
                comment: comment,
                post_id: postId
            })
            .select()
            .single();

        if (error || !data) {
            console.warn("Failed to save day comment:", error);
            return null;
        }

        return {
            id: data.id,
            studyId: data.study_id,
            userId: data.user_id,
            userName: data.user_name,
            userAvatar: data.user_avatar,
            dayNumber: data.day_number,
            comment: data.comment,
            createdAt: data.created_at
        };
    } catch (e) {
        console.error("Failed to add study day comment:", e);
        return null;
    }
};

export const isUserStudyParticipant = async (studyId: string): Promise<boolean> => {
    const user = getCurrentUser();
    if (!user || !supabase) return false;

    try {
        const { data } = await supabase
            .from('study_participants')
            .select('id')
            .eq('study_id', studyId)
            .eq('user_id', user.id)
            .maybeSingle();

        return !!data;
    } catch (e) {
        return false;
    }
};

export const getUserProgressForStudy = async (studyId: string): Promise<number[]> => {
    const user = getCurrentUser();
    if (!user || !supabase) return [];

    try {
        const { data } = await supabase
            .from('study_day_progress')
            .select('day_number')
            .eq('study_id', studyId)
            .eq('user_id', user.id);

        if (!data) return [];
        return data.map((d: any) => d.day_number);
    } catch (e) {
        return [];
    }
};

// Get all studies (owned and joined) with participant info
export const getStudiesWithParticipants = async (): Promise<SermonStudy[]> => {
    const user = getCurrentUser();
    if (!user) return [];

    const allStudies: SermonStudy[] = [];
    const seenIds = new Set<string>();

    // 1. Get studies the user owns
    const ownedStudies = await getStudies();
    for (const study of ownedStudies) {
        seenIds.add(study.id);
        allStudies.push(study);
    }

    // 2. Get studies the user has joined (via study_participants)
    if (supabase) {
        try {
            // Get study IDs where user is a participant
            const { data: participations } = await supabase
                .from('study_participants')
                .select('study_id')
                .eq('user_id', user.id);

            if (participations && participations.length > 0) {
                const joinedStudyIds = participations
                    .map((p: any) => p.study_id)
                    .filter((id: string) => !seenIds.has(id));

                if (joinedStudyIds.length > 0) {
                    // Fetch the full study data for joined studies
                    const { data: joinedStudies } = await supabase
                        .from('studies')
                        .select('*')
                        .in('id', joinedStudyIds)
                        .neq('is_archived', true);

                    if (joinedStudies) {
                        for (const row of joinedStudies) {
                            const study = mapStudyFromDB(row);
                            seenIds.add(study.id);
                            allStudies.push(study);
                        }
                    }
                }
            }

            // 3. Fetch participants for all studies
            const allStudyIds = Array.from(seenIds);
            if (allStudyIds.length > 0) {
                const { data: allParticipants } = await supabase
                    .from('study_participants')
                    .select('*')
                    .in('study_id', allStudyIds);

                // Also get progress data
                const { data: progressData } = await supabase
                    .from('study_day_progress')
                    .select('study_id, user_id, day_number')
                    .in('study_id', allStudyIds);

                // Build progress map
                const progressMap: Record<string, Record<string, number[]>> = {};
                (progressData || []).forEach((p: any) => {
                    if (!progressMap[p.study_id]) progressMap[p.study_id] = {};
                    if (!progressMap[p.study_id][p.user_id]) progressMap[p.study_id][p.user_id] = [];
                    progressMap[p.study_id][p.user_id].push(p.day_number);
                });

                // Attach participants to studies
                const participantsByStudy: Record<string, StudyParticipant[]> = {};
                (allParticipants || []).forEach((p: any) => {
                    if (!participantsByStudy[p.study_id]) participantsByStudy[p.study_id] = [];
                    participantsByStudy[p.study_id].push({
                        id: p.id,
                        studyId: p.study_id,
                        userId: p.user_id,
                        userName: p.user_name || 'Unknown',
                        userAvatar: p.user_avatar,
                        joinedAt: p.joined_at,
                        completedDays: progressMap[p.study_id]?.[p.user_id] || []
                    });
                });

                // Attach to studies
                for (const study of allStudies) {
                    study.participants = participantsByStudy[study.id] || [];
                }
            }
        } catch (e) {
            console.warn("Failed to fetch participants:", e);
        }
    }

    // Sort by date (newest first)
    allStudies.sort((a, b) =>
        new Date(b.dateRecorded).getTime() - new Date(a.dateRecorded).getTime()
    );

    return allStudies;
};
