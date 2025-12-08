import { User } from '../types';
import { supabase } from './supabaseClient';

// Cache current user in memory for sync access in UI components
let currentUserCache: User | null = null;

const mapSupabaseUser = (sbUser: any, profile: any): User => {
    return {
        id: sbUser.id,
        email: sbUser.email || '',
        name: profile?.name || sbUser.user_metadata?.full_name || 'User',
        avatar: profile?.avatar || sbUser.user_metadata?.avatar_url || 'bg-purple-600',
        bio: profile?.bio || '',
        friends: profile?.friends || [],
        googleId: sbUser.app_metadata?.provider === 'google' ? 'linked' : undefined
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
            
        const user = mapSupabaseUser(session.user, profile);
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

        const user = mapSupabaseUser(data.user, profile);
        currentUserCache = user;
        return user;
    }
    throw new Error("Login failed");
};

export const initiateGoogleLogin = async (): Promise<void> => {
    if (!supabase) throw new Error("Supabase not configured");

    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin
        }
    });

    if (error) throw error;
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
    
    const { error } = await supabase
        .from('profiles')
        .update({
            name: updatedUser.name,
            bio: updatedUser.bio,
            avatar: updatedUser.avatar,
            friends: updatedUser.friends
        })
        .eq('id', updatedUser.id);
        
    if (!error) {
        currentUserCache = updatedUser;
    }
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