import { User } from '../types';
import { supabase } from './supabaseClient';

// Cache current user in memory for sync access in UI components
let currentUserCache: User | null = null;

const mapSupabaseUser = (sbUser: any, profile: any, settings: any): User => {
    return {
        id: sbUser.id,
        email: sbUser.email || '',
        name: profile?.name || sbUser.user_metadata?.full_name || 'User',
        avatar: profile?.avatar || sbUser.user_metadata?.avatar_url || 'bg-purple-600',
        bio: profile?.bio || '',
        friends: profile?.friends || [],
        googleId: sbUser.app_metadata?.provider === 'google' ? 'linked' : undefined,
        settings: settings ? {
            churchName: settings.church_name,
            churchLocation: settings.church_location,
            studyDuration: settings.study_duration,
            studyLength: settings.study_length,
            supportingReferencesCount: settings.supporting_references_count,
            notificationTime: settings.notification_time,
            serviceTimes: settings.service_times,
            geofenceEnabled: settings.geofence_enabled,
            sundayReminderEnabled: settings.sunday_reminder_enabled
        } : undefined
    };
};

export const initializeSession = async (): Promise<User | null> => {
    if (!supabase) return null;
    
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
        // Fetch profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
        
        // Fetch settings from user_settings table
        const { data: settings } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', session.user.id)
            .single();
            
        const user = mapSupabaseUser(session.user, profile, settings);
        currentUserCache = user;
        return user;
    }
    return null;
};

export const registerUser = async (email: string, password: string, name: string): Promise<User> => {
    if (!supabase) throw new Error("Supabase not configured");

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { full_name: name }
        }
    });

    if (error) throw error;
    if (data.user) {
        // Profile is created by trigger in SQL, wait slightly or return optimistic
        const user: User = {
            id: data.user.id,
            email: email,
            name: name,
            avatar: 'bg-purple-600',
            friends: []
        };
        currentUserCache = user;
        return user;
    }
    throw new Error("Registration failed");
};

export const loginUser = async (email: string, password: string): Promise<User> => {
    if (!supabase) throw new Error("Supabase not configured");

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) throw error;
    if (data.user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        const { data: settings } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', data.user.id)
            .single();

        const user = mapSupabaseUser(data.user, profile, settings);
        currentUserCache = user;
        return user;
    }
    throw new Error("Login failed");
};

export const initiateGoogleLogin = async (): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");

    const redirectUrl = window.location.origin;
    console.log("Initiating Google Login with redirect:", redirectUrl);

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: redirectUrl,
            skipBrowserRedirect: true // We will handle the redirect manually to ensure it works
        }
    });

    if (error) throw error;
    
    if (data?.url) {
        // Manual redirect
        window.location.href = data.url;
    } else {
        throw new Error("No redirect URL returned from Supabase");
    }
};

export const getCurrentUser = (): User | null => {
    return currentUserCache;
};

export const getUserById = async (id: string): Promise<User | undefined> => {
    if (!supabase) return undefined;
    
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
        
    if (error || !profile) return undefined;
    
    // Construct partial user since we don't have auth user object for others
    return {
        id: profile.id,
        email: profile.email || 'hidden',
        name: profile.name || 'Unknown',
        avatar: profile.avatar,
        bio: profile.bio,
        friends: profile.friends || []
    };
};

export const updateUser = async (updatedUser: User): Promise<void> => {
    if (!supabase) return;
    
    const profilePayload: any = {
        name: updatedUser.name,
        bio: updatedUser.bio,
        avatar: updatedUser.avatar,
        friends: updatedUser.friends
    };

    const { error: profileError } = await supabase
        .from('profiles')
        .update(profilePayload)
        .eq('id', updatedUser.id);
        
    if (profileError) {
        console.error("Error updating profile:", profileError.message);
    }

    if (updatedUser.settings) {
        // Exclude church_location and service_times to prevent schema errors if columns missing
        const settingsPayload = {
            user_id: updatedUser.id,
            church_name: updatedUser.settings.churchName,
            // church_location: updatedUser.settings.churchLocation, 
            study_duration: updatedUser.settings.studyDuration,
            study_length: updatedUser.settings.studyLength,
            supporting_references_count: updatedUser.settings.supportingReferencesCount,
            notification_time: updatedUser.settings.notificationTime,
            // service_times: updatedUser.settings.serviceTimes,
            geofence_enabled: updatedUser.settings.geofenceEnabled,
            sunday_reminder_enabled: updatedUser.settings.sundayReminderEnabled
        };

        const { error: settingsError } = await supabase
            .from('user_settings')
            .upsert(settingsPayload, { onConflict: 'user_id' });
            
        if (settingsError) {
            // Log full object to see details if message is generic
            console.error("Error updating user settings:", JSON.stringify(settingsError));
        }
    }
    
    currentUserCache = updatedUser;
};

export const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    currentUserCache = null;
};

// --- Social ---

export const getCommunityUsers = async (): Promise<User[]> => {
    if (!supabase) return [];
    
    const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', currentUserCache?.id || '')
        .limit(20);
        
    if (!profiles) return [];
    
    return profiles.map((p: any) => ({
        id: p.id,
        email: p.email,
        name: p.name,
        avatar: p.avatar,
        bio: p.bio,
        friends: p.friends || []
    }));
};

export const toggleFriend = async (targetUserId: string): Promise<User | null> => {
    if (!currentUserCache || !supabase) return null;
    
    let newFriends = [...(currentUserCache.friends || [])];
    if (newFriends.includes(targetUserId)) {
        newFriends = newFriends.filter(id => id !== targetUserId);
    } else {
        newFriends.push(targetUserId);
    }
    
    const updatedUser = { ...currentUserCache, friends: newFriends };
    await updateUser(updatedUser);
    return updatedUser;
};