import { User } from '../types';

const USERS_TABLE_KEY = 'sermon_scribe_users_db';
const CURRENT_USER_ID_KEY = 'sermon_scribe_current_user_id';

// Helper to get the "DB"
const getUsersDB = (): User[] => {
  try {
    const stored = localStorage.getItem(USERS_TABLE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

const saveUsersDB = (users: User[]) => {
  localStorage.setItem(USERS_TABLE_KEY, JSON.stringify(users));
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
        avatar: ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500'][Math.floor(Math.random() * 5)]
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

export const getCurrentUser = (): User | null => {
  const currentId = localStorage.getItem(CURRENT_USER_ID_KEY);
  if (!currentId) return null;
  const users = getUsersDB();
  return users.find(u => u.id === currentId) || null;
};

export const logout = () => {
  localStorage.removeItem(CURRENT_USER_ID_KEY);
};