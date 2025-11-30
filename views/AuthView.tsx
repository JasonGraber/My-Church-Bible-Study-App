import React, { useState } from 'react';
import { User } from '../types';
import { loginUser, registerUser } from '../services/authService';

interface AuthViewProps {
  onLogin: (user: User) => void;
}

const AuthView: React.FC<AuthViewProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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

    setIsLoading(true);

    try {
        let user;
        if (isLogin) {
            user = await loginUser(email, password);
        } else {
            user = await registerUser(email, password, name);
        }
        onLogin(user);
    } catch (err: any) {
        setError(err.message || "Authentication failed");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="h-full w-full flex items-center justify-center px-6 bg-gray-900">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
            <h1 className="text-4xl font-serif font-bold text-white mb-2">My Church Bible Study</h1>
            <p className="text-gray-400">Connect with your church. Deepen your faith.</p>
        </div>

        <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-xl">
          <h2 className="text-2xl font-bold text-white mb-6">{isLogin ? "Welcome Back" : "Join the Community"}</h2>
          
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 text-sm p-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Full Name</label>
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
              disabled={isLoading}
              className="w-full py-4 rounded-xl bg-purple-600 text-white font-bold text-lg hover:bg-purple-700 transition-colors shadow-lg mt-4 disabled:opacity-50 disabled:cursor-wait"
            >
              {isLoading ? (
                  <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                  </span>
              ) : (
                  isLogin ? "Sign In" : "Create Account"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(null); }}
              className="text-purple-400 hover:text-purple-300 text-sm font-medium"
            >
              {isLogin ? "New to the church? Join here" : "Already a member? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthView;