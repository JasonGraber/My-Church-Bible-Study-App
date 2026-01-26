
import React, { useState, useEffect, useRef } from 'react';
import { UserSettings, StudyDuration, StudyLength, GeoLocation, DEFAULT_SETTINGS, User, AppView, AIModel, DEFAULT_STUDY_PROMPT } from '../types';
import { saveSettings, getSettings, getUser, logoutUser, updateUser, syncLocalDataToCloud } from '../services/storageService';
import { getCurrentLocation } from '../services/geoService';
import { searchChurch } from '../services/geminiService';

interface SettingsViewProps {
  onUpdate: (settings: UserSettings) => void;
  onLogout: () => void;
  onShowLegal: (view: AppView.PRIVACY_POLICY | AppView.TERMS_OF_SERVICE) => void;
  onViewProfile?: (userId: string) => void;
}

interface SearchResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
  uri?: string;
  serviceTimes?: string[];
}

const SettingsView: React.FC<SettingsViewProps> = ({ onUpdate, onLogout, onShowLegal, onViewProfile }) => {
  const [localSettings, setLocalSettings] = useState<UserSettings>(() => getSettings());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingLoc, setIsLoadingLoc] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const u = getUser();
    setCurrentUser(u);
    if (u) {
        setEditBio(u.bio || "");
        setEditAvatar(u.avatar || "");
    }
  }, []);

  useEffect(() => {
    saveSettings(localSettings);
    onUpdate(localSettings);
  }, [localSettings]);

  const handleLogout = () => {
      logoutUser();
      onLogout();
  };
  
  const handleSaveProfile = () => {
      if (!currentUser) return;
      const updatedUser = { ...currentUser, bio: editBio, avatar: editAvatar };
      updateUser(updatedUser);
      setCurrentUser(updatedUser);
      setIsEditingProfile(false);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;
              const MAX_SIZE = 400;
              if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } 
              else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
              canvas.width = width; canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, width, height);
              setEditAvatar(canvas.toDataURL('image/jpeg', 0.8));
          };
          img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
      e.target.value = '';
  };

  const setLocation = async () => {
    setIsLoadingLoc(true);
    try {
      const loc = await getCurrentLocation();
      setLocalSettings(prev => ({ ...prev, churchLocation: loc, churchName: prev.churchName || "My Church" }));
      setSearchResults([]);
    } catch (e) {
      alert('Could not fetch location.');
    } finally {
      setIsLoadingLoc(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchChurch(searchQuery);
      setSearchResults(results);
    } catch (e) {
      alert("Search failed.");
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = (result: SearchResult) => {
    setLocalSettings(prev => ({
      ...prev,
      churchName: result.name,
      churchLocation: { lat: result.lat, lng: result.lng, address: result.address },
      serviceTimes: result.serviceTimes || []
    }));
    setSearchResults([]);
    setSearchQuery("");
  };

  const incrementRef = () => setLocalSettings(prev => ({...prev, supportingReferencesCount: Math.min((prev.supportingReferencesCount || 0) + 1, 5)}));
  const decrementRef = () => setLocalSettings(prev => ({...prev, supportingReferencesCount: Math.max((prev.supportingReferencesCount || 0) - 1, 0)}));

  const handleSync = async () => {
      if (!confirm("Upload local history to cloud?")) return;
      setIsSyncing(true);
      try {
          const result = await syncLocalDataToCloud();
          alert(`Sync Complete! Uploaded ${result.studies} studies and ${result.bulletins} bulletins.`);
      } catch (e) {
          alert("Sync failed.");
      } finally {
          setIsSyncing(false);
      }
  };

  return (
    <div className="p-6 h-full overflow-y-auto pb-24 max-w-md mx-auto no-scrollbar">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-white">Settings</h1>
        <button onClick={handleLogout} className="text-xs text-red-400 border border-red-900/50 px-3 py-1.5 rounded hover:bg-red-900/20 transition-colors">
            Sign Out
        </button>
      </div>

      <div className="space-y-8">
        {/* Profile Card */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-lg">
            {isEditingProfile ? (
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b border-gray-700 pb-2">Edit Profile</h3>
                    <div className="flex items-center space-x-4 mb-3">
                        <div className={`h-16 w-16 rounded-full ${editAvatar ? 'bg-black' : 'bg-purple-600'} flex-shrink-0 flex items-center justify-center text-white font-bold text-xl overflow-hidden border border-gray-600 shadow-md`}>
                            {editAvatar ? <img src={editAvatar} className="w-full h-full object-cover" /> : currentUser?.name?.charAt(0)}
                        </div>
                        <button onClick={() => avatarInputRef.current?.click()} className="bg-gray-700 text-white px-3 py-1.5 rounded text-xs border border-gray-600">Change Photo</button>
                        <input type="file" ref={avatarInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500">Bio</label>
                        <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none h-20 resize-none mt-1" />
                    </div>
                    <div className="flex space-x-2 pt-2">
                        <button onClick={handleSaveProfile} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-xs font-bold">Save</button>
                        <button onClick={() => setIsEditingProfile(false)} className="bg-gray-700 text-white px-4 py-2 rounded-lg text-xs">Cancel</button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center space-x-4">
                    <div
                        className={`h-14 w-14 rounded-full ${currentUser?.avatar ? 'bg-black' : 'bg-purple-600'} flex-shrink-0 flex items-center justify-center text-white font-bold text-xl overflow-hidden shadow-md cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all`}
                        onClick={() => currentUser?.id && onViewProfile?.(currentUser.id)}
                    >
                        {currentUser?.avatar ? <img src={currentUser.avatar} className="w-full h-full object-cover" /> : currentUser?.name?.charAt(0)}
                    </div>
                    <div
                        className="flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => currentUser?.id && onViewProfile?.(currentUser.id)}
                    >
                        <p className="text-white font-bold truncate">{currentUser?.name}</p>
                        <p className="text-xs text-gray-500 truncate">{currentUser?.email}</p>
                        {currentUser?.bio && <p className="text-xs text-gray-400 italic mt-1 truncate">"{currentUser.bio}"</p>}
                    </div>
                    <button onClick={() => setIsEditingProfile(true)} className="text-xs text-purple-400 hover:underline">Edit</button>
                </div>
            )}
        </div>

        {/* Study Duration */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-400 uppercase tracking-wide">Study Duration</label>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setLocalSettings({ ...localSettings, studyDuration: StudyDuration.FIVE_DAY })} className={`p-4 rounded-xl border-2 transition-all ${localSettings.studyDuration === StudyDuration.FIVE_DAY ? 'border-purple-500 bg-purple-900/20 text-white' : 'border-gray-700 bg-gray-800 text-gray-400'}`}>
              <span className="block text-2xl font-bold mb-1">5 Days</span>
              <span className="text-xs opacity-80">Mon - Fri</span>
            </button>
            <button onClick={() => setLocalSettings({ ...localSettings, studyDuration: StudyDuration.SEVEN_DAY })} className={`p-4 rounded-xl border-2 transition-all ${localSettings.studyDuration === StudyDuration.SEVEN_DAY ? 'border-purple-500 bg-purple-900/20 text-white' : 'border-gray-700 bg-gray-800 text-gray-400'}`}>
              <span className="block text-2xl font-bold mb-1">7 Days</span>
              <span className="text-xs opacity-80">Daily</span>
            </button>
          </div>
        </div>

        {/* Study Length */}
        <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-400 uppercase tracking-wide">Daily Reading Depth</label>
            <div className="grid grid-cols-3 gap-2">
                {[StudyLength.SHORT, StudyLength.MEDIUM, StudyLength.LONG].map(length => (
                    <button 
                        key={length}
                        onClick={() => setLocalSettings({ ...localSettings, studyLength: length })}
                        className={`py-2 px-1 rounded-lg text-[10px] font-bold border transition-all ${localSettings.studyLength === length ? 'border-purple-500 bg-purple-900/20 text-white' : 'border-gray-700 bg-gray-800 text-gray-500'}`}
                    >
                        {length}
                    </button>
                ))}
            </div>
        </div>

        {/* Supporting Verses */}
        <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-400 uppercase tracking-wide">Supporting Verses</label>
            <div className="flex items-center justify-between bg-gray-800 p-4 rounded-xl border border-gray-700">
                <span className="text-gray-300 text-sm">References per day</span>
                <div className="flex items-center space-x-4">
                    <button onClick={decrementRef} className="w-8 h-8 rounded-full bg-gray-700 text-white font-bold">-</button>
                    <span className="text-white font-bold">{localSettings.supportingReferencesCount}</span>
                    <button onClick={incrementRef} className="w-8 h-8 rounded-full bg-gray-700 text-white font-bold">+</button>
                </div>
            </div>
        </div>

        {/* AI Settings */}
        <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-400 uppercase tracking-wide">AI Model</label>
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => setLocalSettings({ ...localSettings, aiModel: AIModel.GEMINI_FLASH })}
                        className={`py-3 px-2 rounded-lg text-xs font-bold border transition-all ${localSettings.aiModel === AIModel.GEMINI_FLASH ? 'border-purple-500 bg-purple-900/20 text-white' : 'border-gray-700 bg-gray-900 text-gray-500'}`}
                    >
                        <span className="block text-sm">Flash</span>
                        <span className="text-[10px] opacity-70">Faster</span>
                    </button>
                    <button
                        onClick={() => setLocalSettings({ ...localSettings, aiModel: AIModel.GEMINI_PRO })}
                        className={`py-3 px-2 rounded-lg text-xs font-bold border transition-all ${(localSettings.aiModel === AIModel.GEMINI_PRO || !localSettings.aiModel) ? 'border-purple-500 bg-purple-900/20 text-white' : 'border-gray-700 bg-gray-900 text-gray-500'}`}
                    >
                        <span className="block text-sm">Pro</span>
                        <span className="text-[10px] opacity-70">Higher Quality</span>
                    </button>
                </div>
                <p className="text-[10px] text-gray-500">Flash is faster but Pro produces more thoughtful studies.</p>
            </div>
        </div>

        {/* Custom Prompt */}
        <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-400 uppercase tracking-wide">Custom Instructions</label>
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 space-y-3">
                <textarea
                    value={localSettings.customPrompt || ""}
                    onChange={(e) => setLocalSettings({ ...localSettings, customPrompt: e.target.value })}
                    placeholder={DEFAULT_STUDY_PROMPT}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 h-28 resize-none"
                />
                <p className="text-[10px] text-gray-500">Customize how AI generates your studies. Leave blank to use defaults.</p>
                {localSettings.customPrompt && (
                    <button
                        onClick={() => setLocalSettings({ ...localSettings, customPrompt: "" })}
                        className="text-xs text-purple-400 hover:underline"
                    >
                        Reset to Default
                    </button>
                )}
            </div>
        </div>

        {/* Notifications */}
        <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-400 uppercase tracking-wide">Notifications</label>
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 space-y-4">
                <div className="flex items-center justify-between">
                    <span className="text-gray-300 text-sm">Morning Reminder</span>
                    <input 
                        type="time" 
                        value={localSettings.notificationTime} 
                        onChange={(e) => setLocalSettings({...localSettings, notificationTime: e.target.value})}
                        className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-white outline-none"
                    />
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-gray-300 text-sm">Sunday Geofence Alerts</span>
                    <button 
                        onClick={() => setLocalSettings({...localSettings, sundayReminderEnabled: !localSettings.sundayReminderEnabled})}
                        className={`w-12 h-6 rounded-full transition-colors relative ${localSettings.sundayReminderEnabled ? 'bg-purple-600' : 'bg-gray-700'}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${localSettings.sundayReminderEnabled ? 'right-1' : 'left-1'}`} />
                    </button>
                </div>
            </div>
        </div>

        {/* Church Location */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-400 uppercase tracking-wide">Home Church</label>
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 space-y-4">
            <div className="flex gap-2">
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="Search church..." className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none" />
                <button onClick={handleSearch} disabled={isSearching || !searchQuery} className="bg-gray-700 text-white px-4 rounded text-sm disabled:opacity-50">{isSearching ? "..." : "Find"}</button>
            </div>
            {searchResults.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                    {searchResults.map((result, idx) => (
                        <div key={idx} onClick={() => selectSearchResult(result)} className="bg-gray-900 p-3 rounded border border-gray-700 hover:border-purple-500 cursor-pointer">
                            <p className="font-bold text-sm text-white">{result.name}</p>
                            <p className="text-xs text-gray-400 truncate">{result.address}</p>
                        </div>
                    ))}
                </div>
            )}
            <div className="pt-2">
                <p className="text-xs text-gray-500 mb-2">Linked: <span className="text-white">{localSettings.churchName || "Not Set"}</span></p>
                <button onClick={setLocation} className="w-full py-2 bg-gray-700 text-white rounded text-xs">Set to Current GPS</button>
            </div>
          </div>
        </div>
        
        {/* Sync */}
        <div className="pt-6 border-t border-gray-800">
            <button onClick={handleSync} disabled={isSyncing} className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold shadow-lg disabled:opacity-50">
                {isSyncing ? "Syncing..." : "Sync Local Data to Cloud"}
            </button>
        </div>

        {/* Legal Footer */}
        <div className="flex justify-center space-x-6 pt-4">
            <button onClick={() => onShowLegal(AppView.PRIVACY_POLICY)} className="text-[10px] text-gray-500 hover:text-gray-300">Privacy Policy</button>
            <button onClick={() => onShowLegal(AppView.TERMS_OF_SERVICE)} className="text-[10px] text-gray-500 hover:text-gray-300">Terms of Service</button>
        </div>

        {/* Version */}
        <div className="text-center text-[10px] text-gray-600 pt-2">
            v{(process.env.COMMIT_SHA || 'dev').substring(0, 7)}
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
