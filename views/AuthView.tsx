import React, { useState, useEffect } from 'react';
import { User, AppView } from '../types';
import { loginUser, registerUser, loginWithGoogle } from '../services/authService';

interface AuthViewProps {
  onLogin: (user: User) => void;
  onShowLegal: (view: AppView.PRIVACY_POLICY | AppView.TERMS_OF_SERVICE) => void;
}

const AuthView: React.FC<AuthViewProps> = ({ onLogin, onShowLegal }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Custom Google Client ID
  const [googleClientId, setGoogleClientId] = useState("553002717608-gs6ibvkil8smkej0cnjet44s8d8dvs9f.apps.googleusercontent.com");
  const [tempClientId, setTempClientId] = useState("");
  const [isEditingClientId, setIsEditingClientId] = useState(false);
  
  // PWA Install State
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Initialize Google Sign-In when Client ID changes
  useEffect(() => {
    if (!googleClientId) return;

    const handleGoogleResponse = async (response: any) => {
        try {
            setIsLoading(true);
            const user = await loginWithGoogle(response.credential);
            onLogin(user);
        } catch (err: any) {
            setError(err.message || "Google Sign-In Failed");
        } finally {
            setIsLoading(false);
        }
    };

    // Small timeout to ensure script is loaded and DOM element exists
    const timer = setTimeout(() => {
        if ((window as any).google && document.getElementById("googleSignInDiv")) {
            try {
                (window as any).google.accounts.id.initialize({
                    client_id: googleClientId,
                    callback: handleGoogleResponse
                });
                (window as any).google.accounts.id.renderButton(
                    document.getElementById("googleSignInDiv"),
                    { theme: "outline", size: "large", width: "100%", text: isLogin ? "signin_with" : "signup_with" }
                );
            } catch(e) {
                console.error("Google Auth Init Failed", e);
            }
        }
    }, 500);

    return () => clearTimeout(timer);
  }, [googleClientId, isLogin, onLogin]);

  const handleInstallClick = () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.then((choiceResult: any) => {
      setInstallPrompt(null);
    });
  };

  const handleSaveClientId = () => {
      if (tempClientId.trim()) {
          setGoogleClientId(tempClientId.trim());
          setIsEditingClientId(false);
          // Force re-render of button
          const div = document.getElementById("googleSignInDiv");
          if (div) div.innerHTML = "";
      }
  };

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
    <div className="h-full w-full flex items-center justify-center px-6 bg-gray-900 relative overflow-y-auto py-10">
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
            
          {/* Google Button Container or Config Input */}
          {isEditingClientId ? (
              <div className="bg-gray-900 p-4 rounded-xl border border-dashed border-gray-600 mb-6">
                  <p className="text-xs text-gray-400 mb-2 font-bold uppercase">Configure Google Sign-In</p>
                  <input 
                    type="text" 
                    placeholder="Paste Google Client ID here"
                    value={tempClientId}
                    onChange={(e) => setTempClientId(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-xs text-white focus:border-purple-500 focus:outline-none mb-2"
                  />
                  <div className="flex space-x-2">
                      <button 
                        onClick={handleSaveClientId}
                        disabled={!tempClientId}
                        className="flex-1 bg-purple-600 text-white text-xs font-bold py-2 rounded hover:bg-purple-700 disabled:opacity-50"
                      >
                          Save & Reload
                      </button>
                      <button 
                        onClick={() => setIsEditingClientId(false)}
                        className="flex-1 bg-gray-700 text-gray-300 text-xs font-bold py-2 rounded hover:bg-gray-600"
                      >
                          Cancel
                      </button>
                  </div>
              </div>
          ) : (
              <div className="mb-4">
                  <div id="googleSignInDiv" className="w-full min-h-[40px]"></div>
                  {/* Hidden developer option to change client ID if needed */}
                  <div className="flex justify-center mt-2 opacity-0 hover:opacity-100 transition-opacity">
                      <button onClick={() => { setTempClientId(googleClientId); setIsEditingClientId(true); }} className="text-[10px] text-gray-700 hover:text-gray-500">
                          Edit Client ID
                      </button>
                  </div>
              </div>
          )}

          <div className="flex items-center my-4">
            <div className="flex-grow border-t border-gray-700"></div>
            <span className="flex-shrink-0 mx-4 text-gray-500 text-sm">OR</span>
            <div className="flex-grow border-t border-gray-700"></div>
          </div>

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
        
        {/* Legal Links */}
        <div className="flex justify-center space-x-4 text-xs text-gray-500 mt-8 mb-4">
            <button onClick={() => onShowLegal(AppView.PRIVACY_POLICY)} className="hover:text-gray-300">Privacy Policy</button>
            <span>•</span>
            <button onClick={() => onShowLegal(AppView.TERMS_OF_SERVICE)} className="hover:text-gray-300">Terms of Service</button>
        </div>

      </div>

      {/* PWA Install Banner */}
      {installPrompt && (
        <div className="absolute bottom-6 left-6 right-6 bg-purple-900 border border-purple-500 p-4 rounded-xl flex items-center justify-between shadow-2xl animate-slide-up z-50">
            <div className="flex items-center">
                 <div className="bg-white p-2 rounded-lg mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.968 7.968 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                    </svg>
                 </div>
                 <div>
                     <p className="font-bold text-white text-sm">Install App</p>
                     <p className="text-purple-200 text-xs">Add to your home screen</p>
                 </div>
            </div>
            <button 
                onClick={handleInstallClick}
                className="bg-white text-purple-900 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-100 transition-colors"
            >
                Install
            </button>
        </div>
      )}
    </div>
  );
};

export default AuthView;