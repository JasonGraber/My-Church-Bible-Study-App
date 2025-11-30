import React, { useState } from 'react';
import { User } from '../types';
import { saveUser } from '../services/storageService';

interface AuthViewProps {
  onLogin: (user: User) => void;
}

const AuthView: React.FC<AuthViewProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please fill in all required fields");
      return;
    }

    if (!isLogin && !name) {
      setError("Please enter your name");
      return;
    }

    // Mock Authentication Logic
    // In a real app, this would hit an API
    const newUser: User = {
      id: crypto.randomUUID(),
      email,
      name: name || email.split('@')[0],
    };

    saveUser(newUser);
    onLogin(newUser);
  };

  return (
    <div className="h-full w-full flex items-center justify-center px-6 bg-gray-900">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
            <h1 className="text-4xl font-serif font-bold text-white mb-2">My Church Bible Study</h1>
            <p className="text-gray-400">Your personal sermon companion</p>
        </div>

        <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-xl">
          <h2 className="text-2xl font-bold text-white mb-6">{isLogin ? "Welcome Back" : "Create Account"}</h2>
          
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 text-sm p-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-purple-500 focus:outline-none transition-colors"
                  placeholder="John Doe"
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-purple-500 focus:outline-none transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-purple-500 focus:outline-none transition-colors"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 rounded-xl bg-white text-gray-900 font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg mt-4"
            >
              {isLogin ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsLogin(!isLogin); setError(null); }}
              className="text-purple-400 hover:text-purple-300 text-sm font-medium"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthView;