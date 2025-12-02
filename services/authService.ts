
import { User } from '../types';

const USERS_TABLE_KEY = 'sermon_scribe_users_db';
const CURRENT_USER_ID_KEY = 'sermon_scribe_current_user_id';

// Initial Mock Data to populate the app
const MOCK_USERS: User[] = [
    { id: 'mock-1', name: 'Pastor Mike', email: 'mike@church.com', avatar: 'bg-blue-600', bio: 'Lead Pastor at Grace Community. Passionate about expository preaching.', friends: [] },
    { id: 'mock-2', name: 'Sarah Jenkins', email: 'sarah@church.com', avatar: 'bg-pink-500', bio: 'Worship leader and mom of 3. Love the Psalms!', friends: [] },
    { id: 'mock-3', name: 'Youth Leader', email: 'youth@church.com', avatar: 'bg-yellow-500', bio: 'Serving the next generation.', friends: [] },
    { id: 'mock-4', name: 'Grace Church', email: 'info@church.com', avatar: 'bg-purple-700', bio: 'Official updates from the church office.', friends: [] },
];

// Helper to get the "DB"
const getUsersDB = (): User[] => {
  try {
    const stored = localStorage.getItem(USERS_TABLE_KEY);
    if (!stored) {
        // Seed mock users if empty
        saveUsersDB(MOCK_USERS);
        return MOCK_USERS;
    }
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
};

const saveUsersDB = (users: User[]) => {
  localStorage.setItem(USERS_TABLE_KEY, JSON.stringify(users));
};

// Helper to decode JWT (Google ID Token)
const parseJwt = (token: string) => {
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
      return null;
    }
};

export const registerUser = (email: string, password: string, name: string): Promise<User> => {
  return new Promise((resolve, reject) => {
    // Simulate network delay
    setTimeout(() => {
      const users = getUsersDB();
      
      if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        reject(new Error("Email already registered"));
        return;
      }

      const newUser: User = {
        id: crypto.randomUUID(),
        email,
        name,
        password, // In a real app, hash this!
        avatar: ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500'][Math.floor(Math.random() * 5)],
        friends: []
      };

      users.push(newUser);
      saveUsersDB(users);
      
      // Auto login
      localStorage.setItem(CURRENT_USER_ID_KEY, newUser.id);
      resolve(newUser);
    }, 800);
  });
};

export const loginUser = (email: string, password: string): Promise<User> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const users = getUsersDB();
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

      if (!user) {
        reject(new Error("User not found"));
        return;
      }

      if (user.password !== password) {
        reject(new Error("Invalid password"));
        return;
      }

      localStorage.setItem(CURRENT_USER_ID_KEY, user.id);
      resolve(user);
    }, 800);
  });
};

export const loginWithGoogle = (credential: string): Promise<User> => {
    return new Promise((resolve, reject) => {
        const payload = parseJwt(credential);
        if (!payload) {
            reject(new Error("Invalid Google Token"));
            return;
        }

        const email = payload.email;
        const name = payload.name;
        const picture = payload.picture;
        const googleId = payload.sub;

        const users = getUsersDB();
        // Check if user exists by email OR googleId
        let user = users.find(u => 
            u.email.toLowerCase() === email.toLowerCase() || 
            (u.googleId && u.googleId === googleId)
        );

        if (user) {
            // Log in existing user
            // Optional: Update avatar if changed
            if (picture && !user.avatar?.startsWith('bg-')) {
                user.avatar = picture; 
                saveUsersDB(users); // Persist update
            }
            
            localStorage.setItem(CURRENT_USER_ID_KEY, user.id);
            resolve(user);
        } else {
            // Register new user from Google profile
             const newUser: User = {
                id: crypto.randomUUID(),
                email,
                name,
                password: "", // No password for google users
                avatar: picture || 'bg-blue-500',
                googleId: googleId,
                friends: []
            };
            
            users.push(newUser);
            saveUsersDB(users);
            localStorage.setItem(CURRENT_USER_ID_KEY, newUser.id);
            resolve(newUser);
        }
    });
}

export const getCurrentUser = (): User | null => {
  const currentId = localStorage.getItem(CURRENT_USER_ID_KEY);
  if (!currentId) return null;
  const users = getUsersDB();
  return users.find(u => u.id === currentId) || null;
};

export const getUserById = (id: string): User | undefined => {
    const users = getUsersDB();
    return users.find(u => u.id === id);
};

export const updateUser = (updatedUser: User): void => {
    const users = getUsersDB();
    const idx = users.findIndex(u => u.id === updatedUser.id);
    if (idx !== -1) {
        users[idx] = updatedUser;
        saveUsersDB(users);
    }
}

export const logout = () => {
  localStorage.removeItem(CURRENT_USER_ID_KEY);
};

// --- Social Graph Functions ---

export const getCommunityUsers = (): User[] => {
    const currentId = localStorage.getItem(CURRENT_USER_ID_KEY);
    const users = getUsersDB();
    // Return everyone except self
    return users.filter(u => u.id !== currentId);
};

export const toggleFriend = (targetUserId: string): User | null => {
    const currentId = localStorage.getItem(CURRENT_USER_ID_KEY);
    if (!currentId) return null;

    const users = getUsersDB();
    const currentUserIdx = users.findIndex(u => u.id === currentId);
    
    if (currentUserIdx === -1) return null;

    const currentUser = users[currentUserIdx];
    const friends = currentUser.friends || [];

    if (friends.includes(targetUserId)) {
        // Remove friend
        currentUser.friends = friends.filter(id => id !== targetUserId);
    } else {
        // Add friend
        currentUser.friends = [...friends, targetUserId];
    }

    users[currentUserIdx] = currentUser;
    saveUsersDB(users);
    
    return currentUser;
};
