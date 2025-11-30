import React, { useState } from 'react';
import { UserSettings } from '../types';
import { saveSettings } from '../services/storageService';
import { searchChurch } from '../services/geminiService';

interface OnboardingViewProps {
  settings: UserSettings;
  onComplete: (settings: UserSettings) => void;
}

interface SearchResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
  uri?: string;
  serviceTimes?: string[];
}

const OnboardingView: React.FC<OnboardingViewProps> = ({ settings, onComplete }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchResults([]);
    setError(null);
    
    try {
      const results = await searchChurch(searchQuery);
      setSearchResults(results);
      if (results.length === 0) {
          setError("No churches found. Try adding the city or zip code.");
      }
    } catch (e) {
      console.error(e);
      setError("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelect = (result: SearchResult) => {
    const updatedSettings: UserSettings = {
        ...settings,
        churchName: result.name,
        churchLocation: {
            lat: result.lat,
            lng: result.lng,
            address: result.address
        },
        serviceTimes: result.serviceTimes || [],
        geofenceEnabled: true, // Auto-enable geofence on setup
        sundayReminderEnabled: true
    };
    saveSettings(updatedSettings);
    onComplete(updatedSettings);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 bg-gray-900 animate-fade-in">
        <div className="max-w-md w-full space-y-8">
            <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-purple-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-purple-900/50 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                </div>
                <h1 className="text-3xl font-serif font-bold text-white">Find Your Church</h1>
                <p className="text-gray-400">Search for your home church so we can remind you to record the message on Sundays.</p>
            </div>

            <div className="space-y-4">
                <div className="relative">
                    <input 
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="e.g. Hillsong NYC"
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-4 pl-12 text-white focus:border-purple-500 focus:outline-none transition-colors shadow-inner"
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500 absolute left-4 top-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <button 
                        onClick={handleSearch}
                        disabled={isSearching || !searchQuery}
                        className="absolute right-2 top-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-0 disabled:pointer-events-none"
                    >
                        Search
                    </button>
                </div>

                {isSearching && (
                    <div className="flex justify-center py-4">
                         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                    </div>
                )}

                {error && (
                    <p className="text-red-400 text-center text-sm">{error}</p>
                )}

                {searchResults.length > 0 && (
                    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-xl max-h-[300px] overflow-y-auto">
                        <div className="p-3 border-b border-gray-700 bg-gray-800 sticky top-0">
                            <p className="text-xs font-bold text-gray-400 uppercase">Select your church</p>
                        </div>
                        {searchResults.map((result, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleSelect(result)}
                                className="w-full text-left p-4 border-b border-gray-700 last:border-0 hover:bg-gray-700/50 transition-colors flex justify-between items-center group"
                            >
                                <div>
                                    <p className="font-bold text-white text-lg group-hover:text-purple-400 transition-colors">{result.name}</p>
                                    <p className="text-sm text-gray-400">{result.address}</p>
                                    {result.serviceTimes && result.serviceTimes.length > 0 && (
                                        <p className="text-xs text-green-400 mt-1 flex items-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {result.serviceTimes.join(', ')}
                                        </p>
                                    )}
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600 group-hover:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default OnboardingView;