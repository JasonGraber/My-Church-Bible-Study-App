

import React, { useState, useEffect, useRef } from 'react';
import { UserSettings, StudyDuration, StudyLength, GeoLocation, DEFAULT_SETTINGS, User, AppView } from '../types';
import { saveSettings, getSettings, getUser, logoutUser, updateUser } from '../services/storageService';
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
  // Initialize from storage directly
  const [localSettings, setLocalSettings] = useState<UserSettings>(() => getSettings());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingLoc, setIsLoadingLoc] = useState(false);
  
  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    const u = getUser();
    setCurrentUser(u);
    if (u) {
        setEditBio(u.bio || "");
        setEditAvatar(u.avatar || "");
    }
  }, []);

  // Autosave effect
  useEffect(() => {
    saveSettings(localSettings);
    onUpdate(localSettings);
  }, [localSettings, onUpdate]);

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

      // Resize logic to keep storage light (client-side compression)
      const reader = new FileReader();
      reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;
              const MAX_SIZE = 400; // Resize to max 400px

              if (width > height) {
                  if (width > MAX_SIZE) {
                      height *= MAX_SIZE / width;
                      width = MAX_SIZE;
                  }
              } else {
                  if (height > MAX_SIZE) {
                      width *= MAX_SIZE / height;
                      height = MAX_SIZE;
                  }
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, width, height);
              // Convert to compressed JPEG base64 (0.8 quality)
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              setEditAvatar(dataUrl);
          };
          img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
      // Clear input so same file can be selected again
      e.target.value = '';
  };

  const setLocation = async () => {
    setIsLoadingLoc(true);
    try {
      const loc = await getCurrentLocation();
      setLocalSettings(prev => ({
        ...prev,
        churchLocation: loc,
        churchName: prev.churchName || "My Church"
      }));
      setSearchResults([]); // Clear search results on manual set
    } catch (e) {
      alert('Could not fetch location. Please enable permissions.');
    } finally {
      setIsLoadingLoc(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchResults([]);
    
    try {
      const results = await searchChurch(searchQuery);
      setSearchResults(results);
    } catch (e) {
      console.error(e);
      alert("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = (result: SearchResult) => {
    setLocalSettings(prev => ({
      ...prev,
      churchName: result.name,
      churchLocation: {
        lat: result.lat,
        lng: result.lng,
        address: result.address
      },
      serviceTimes: result.serviceTimes || []
    }));
    setSearchResults([]);
    setSearchQuery("");
  };

  const requestNotificationPermission = async () => {
      const result = await Notification.requestPermission();
      if (result === 'granted') {
          alert("Notifications enabled!");
      } else {
          alert("Notifications denied.");
      }
  }

  const incrementRef = () => {
      setLocalSettings(prev => ({...prev, supportingReferencesCount: Math.min((prev.supportingReferencesCount || 0) + 1, 5)}));
  }

  const decrementRef = () => {
    setLocalSettings(prev => ({...prev, supportingReferencesCount: Math.max((prev.supportingReferencesCount || 0) - 1, 0)}));
  }

  return (
    <div className="p-6 h-full overflow-y-auto pb-24 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-white">Settings</h1>
        <button onClick={handleLogout} className="text-xs text-red-400 border border-red-900/50 px-3 py-1.5 rounded hover:bg-red-900/20 transition-colors">
            Sign Out
        </button>
      </div>

      <div className="space-y-8">
        
        {/* Profile Section */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            {isEditingProfile ? (
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b border-gray-700 pb-2">Edit Profile</h3>
                    
                    {/* Avatar Upload */}
                    <div>
                        <label className="text-xs text-gray-500 mb-2 block">Profile Picture</label>
                        <div className="flex items-center space-x-4 mb-3">
                            <div className={`h-16 w-16 rounded-full ${editAvatar ? 'bg-black' : 'bg-purple-600'} flex-shrink-0 flex items-center justify-center text-white font-bold text-xl overflow-hidden border border-gray-600 shadow-md`}>
                                {editAvatar && (editAvatar.startsWith('http') || editAvatar.startsWith('data:')) ? (
                                     <img src={editAvatar} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    editAvatar || currentUser?.name?.charAt(0).toUpperCase() || "U"
                                )}
                            </div>
                            <div className="flex flex-col space-y-2">
                                <button 
                                    onClick={() => avatarInputRef.current?.click()} 
                                    className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-xs border border-gray-600 transition-colors"
                                >
                                    Upload Photo
                                </button>
                                {editAvatar && (
                                    <button 
                                        onClick={() => setEditAvatar("")} 
                                        className="text-xs text-red-400 hover:text-red-300 text-left"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                            <input 
                                type="file" 
                                ref={avatarInputRef} 
                                onChange={handleAvatarUpload} 
                                accept="image/*" 
                                className="hidden" 
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-gray-500">Bio</label>
                        <textarea 
                            value={editBio}
                            onChange={(e) => setEditBio(e.target.value)}
                            placeholder="Share a bit about your faith journey..."
                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-2 text-sm text-white focus:border-purple-500 focus:outline-none h-20 resize-none mt-1"
                        />
                    </div>
                    <div className="flex space-x-2 pt-2">
                        <button onClick={handleSaveProfile} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors">Save</button>
                        <button onClick={() => setIsEditingProfile(false)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-xs transition-colors">Cancel</button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center space-x-4">
                    <div className={`h-14 w-14 rounded-full ${currentUser?.avatar || 'bg-purple-600'} flex-shrink-0 flex items-center justify-center text-white font-bold text-xl overflow-hidden shadow-md`}>
                        {currentUser?.avatar && (currentUser.avatar.startsWith('http') || currentUser.avatar.startsWith('data:')) ? (
                             <img src={currentUser.avatar} alt="av" className="w-full h-full object-cover" />
                        ) : (
                            currentUser?.name?.charAt(0).toUpperCase() || "U"
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-white font-bold truncate">{currentUser?.name}</p>
                        <p className="text-xs text-gray-500 truncate">{currentUser?.email}</p>
                        {currentUser?.bio && <p className="text-xs text-gray-400 mt-1 italic truncate">"{currentUser.bio}"</p>}
                    </div>
                    <button onClick={() => setIsEditingProfile(true)} className="text-xs text-purple-400 hover:underline">Edit</button>
                </div>
            )}
            
            {!isEditingProfile && onViewProfile && currentUser && (
                <button 
                    onClick={() => onViewProfile(currentUser.id)}
                    className="w-full mt-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded transition-colors"
                >
                    View Public Profile
                </button>
            )}
        </div>

        {/* Study Duration */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-400 uppercase tracking-wide">Study Duration</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setLocalSettings({ ...localSettings, studyDuration: StudyDuration.FIVE_DAY })}
              className={`p-4 rounded-xl border-2 transition-all ${localSettings.studyDuration === StudyDuration.FIVE_DAY ? 'border-purple-500 bg-purple-900/20 text-white' : 'border-gray-700 bg-gray-800 text-gray-400'}`}
            >
              <span className="block text-2xl font-bold mb-1">5 Days</span>
              <span className="text-xs opacity-80">Mon - Fri</span>
            </button>
            <button
              onClick={() => setLocalSettings({ ...localSettings, studyDuration: StudyDuration.SEVEN_DAY })}
              className={`p-4 rounded-xl border-2 transition-all ${localSettings.studyDuration === StudyDuration.SEVEN_DAY ? 'border-purple-500 bg-purple-900/20 text-white' : 'border-gray-700 bg-gray-800 text-gray-400'}`}
            >
              <span className="block text-2xl font-bold mb-1">7 Days</span>
              <span className="text-xs opacity-80">Daily</span>
            </button>
          </div>
        </div>

        {/* Study Time Allocation */}
        <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-400 uppercase tracking-wide">Time per Day</label>
            <div className="grid grid-cols-3 gap-2">
                {[StudyLength.SHORT, StudyLength.MEDIUM, StudyLength.LONG].map((len) => (
                    <button
                        key={len}
                        onClick={() => setLocalSettings({...localSettings, studyLength: len})}
                        className={`py-3 px-2 rounded-lg border-2 text-center transition-all ${localSettings.studyLength === len ? 'border-purple-500 bg-purple-900/20 text-white' : 'border-gray-700 bg-gray-800 text-gray-400'}`}
                    >
                        <span className="block text-sm font-bold">{len}</span>
                    </button>
                ))}
            </div>
        </div>

        {/* Supporting References */}
        <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-400 uppercase tracking-wide">Supporting Verses per day</label>
            <div className="flex items-center justify-between bg-gray-800 p-4 rounded-xl border border-gray-700">
                <span className="text-gray-300 text-sm">Extra References</span>
                <div className="flex items-center space-x-4">
                    <button onClick={decrementRef} className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white font-bold text-lg">-</button>
                    <span className="w-4 text-center text-white font-bold">{localSettings.supportingReferencesCount || 0}</span>
                    <button onClick={incrementRef} className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white font-bold text-lg">+</button>
                </div>
            </div>
        </div>

        {/* Notifications */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-400 uppercase tracking-wide">Notifications</label>
          
          <div className="space-y-2">
            {/* Daily Bible Study Reminder */}
            <div className="flex items-center justify-between bg-gray-800 p-4 rounded-xl border border-gray-700">
                <span className="text-gray-300 text-sm">Daily Study Reminder</span>
                <input
                type="time"
                value={localSettings.notificationTime}
                onChange={(e) => setLocalSettings({ ...localSettings, notificationTime: e.target.value })}
                className="bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
            </div>

            {/* Sunday Church Reminder */}
            <div className="flex items-center justify-between bg-gray-800 p-4 rounded-xl border border-gray-700">
                <div>
                    <span className="block text-gray-300 text-sm">Sunday Church Reminder</span>
                    {localSettings.serviceTimes && localSettings.serviceTimes.length > 0 && (
                        <span className="text-[10px] text-gray-500">Based on services: {localSettings.serviceTimes.join(', ')}</span>
                    )}
                </div>
                
                <label className="inline-flex items-center cursor-pointer">
                    <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={localSettings.sundayReminderEnabled !== false} // Default true
                        onChange={(e) => setLocalSettings({...localSettings, sundayReminderEnabled: e.target.checked})}
                    />
                    <div className="relative w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
            </div>
            
            <button onClick={requestNotificationPermission} className="text-xs text-purple-400 hover:text-purple-300 underline block text-right pt-1">
                Enable / Test Permissions
            </button>
          </div>
        </div>

        {/* Church Location */}
        <div className="space-y-3">
            <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-gray-400 uppercase tracking-wide">Church Location</label>
                <label className="inline-flex items-center cursor-pointer">
                    <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={localSettings.geofenceEnabled}
                        onChange={(e) => setLocalSettings({...localSettings, geofenceEnabled: e.target.checked})}
                    />
                    <div className="relative w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
            </div>
          
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 space-y-3">
            
            {/* Search Box */}
            <div className="flex gap-2">
                <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search church name..."
                    className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none"
                />
                <button 
                    onClick={handleSearch}
                    disabled={isSearching || !searchQuery}
                    className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
                >
                    {isSearching ? "..." : "Find"}
                </button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
                <div className="space-y-2 mt-2">
                    <p className="text-xs text-gray-400 uppercase font-bold">Results</p>
                    {searchResults.map((result, idx) => (
                        <div 
                            key={idx} 
                            onClick={() => selectSearchResult(result)}
                            className="bg-gray-900 p-3 rounded border border-gray-700 hover:border-purple-500 cursor-pointer group"
                        >
                            <p className="font-bold text-sm text-white group-hover:text-purple-400">{result.name}</p>
                            <p className="text-xs text-gray-400 truncate">{result.address}</p>
                            {result.serviceTimes && result.serviceTimes.length > 0 && (
                                <p className="text-[10px] text-green-400 mt-1">Services: {result.serviceTimes.join(', ')}</p>
                            )}
                            {result.uri && (
                                <a 
                                    href={result.uri} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[10px] text-blue-400 hover:underline block mt-1"
                                >
                                    View on Maps
                                </a>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div className="border-t border-gray-700 my-2"></div>

            <div>
                <label className="text-xs text-gray-500">Selected Church</label>
                <input 
                    type="text" 
                    value={localSettings.churchName}
                    onChange={(e) => setLocalSettings({...localSettings, churchName: e.target.value})}
                    placeholder="e.g. Grace Community"
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white mt-1 focus:border-purple-500 focus:outline-none"
                />
            </div>
            
            <div className="flex items-center justify-between pt-2">
                <div className="flex flex-col">
                    <span className="text-xs text-gray-400">
                        {localSettings.churchLocation && typeof localSettings.churchLocation.lat === 'number' && typeof localSettings.churchLocation.lng === 'number'
                            ? `${localSettings.churchLocation.lat.toFixed(4)}, ${localSettings.churchLocation.lng.toFixed(4)}` 
                            : "Location not set"}
                    </span>
                    {localSettings.churchLocation?.address && (
                         <span className="text-[10px] text-gray-500 truncate max-w-[180px]">{localSettings.churchLocation.address}</span>
                    )}
                </div>
                <button 
                    onClick={setLocation}
                    disabled={isLoadingLoc}
                    className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded transition-colors whitespace-nowrap"
                >
                    {isLoadingLoc ? "Locating..." : "Use Current GPS"}
                </button>
            </div>
            <p className="text-[10px] text-gray-500 leading-tight">
                Search for your church or use your current GPS location to set the geofence.
            </p>
          </div>
        </div>
        
        {/* Footer Links */}
        <div className="flex justify-center space-x-4 text-xs text-gray-500 pt-8 pb-4">
            <button onClick={() => onShowLegal(AppView.PRIVACY_POLICY)} className="hover:text-gray-300">Privacy Policy</button>
            <span>•</span>
            <button onClick={() => onShowLegal(AppView.TERMS_OF_SERVICE)} className="hover:text-gray-300">Terms of Service</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;