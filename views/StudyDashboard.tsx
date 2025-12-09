
import React, { useState, useEffect } from 'react';
import { SermonStudy, User } from '../types';
import { getStudies, deleteStudy } from '../services/storageService';
import { createPost } from '../services/socialService';
import { getCommunityUsers, toggleFriend, getCurrentUser } from '../services/authService';

interface StudyDashboardProps {
  onSelectStudy: (study: SermonStudy) => void;
  onCreateStudy: (action: 'UPLOAD_AUDIO' | 'SCAN_NOTES' | 'PASTE_TEXT') => void;
}

const StudyDashboard: React.FC<StudyDashboardProps> = ({ onSelectStudy, onCreateStudy }) => {
  const [studies, setStudies] = useState<SermonStudy[]>([]);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [loading, setLoading] = useState(true);

  // Share Modal State
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [studyToShare, setStudyToShare] = useState<SermonStudy | null>(null);
  const [communityUsers, setCommunityUsers] = useState<User[]>([]);
  const [shareSearch, setShareSearch] = useState("");
  const [sharing, setSharing] = useState(false);

  // Delete Confirmation State
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);

  const loadStudies = async () => {
      setLoading(true);
      const data = await getStudies();
      setStudies(data);
      setLoading(false);
  }

  useEffect(() => {
    loadStudies();
  }, []);

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setDeleteConfirmationId(id);
  }

  const confirmDelete = async () => {
      if (deleteConfirmationId) {
          await deleteStudy(deleteConfirmationId);
          setDeleteConfirmationId(null);
          loadStudies();
      }
  }

  const openShareModal = async (e: React.MouseEvent, study: SermonStudy) => {
      e.stopPropagation();
      setStudyToShare(study);
      setShareModalOpen(true);
      // Pre-load users for the friend picker
      const users = await getCommunityUsers();
      setCommunityUsers(users);
  };

  const closeShareModal = () => {
      setShareModalOpen(false);
      setStudyToShare(null);
      setShareSearch("");
  };

  const handlePostToFeed = async () => {
      if (!studyToShare) return;
      setSharing(true);
      try {
          await createPost(`I just finished generating a study for "${studyToShare.sermonTitle}". It's really good!`, 'STUDY_SHARE', studyToShare.id);
          alert("Posted to Community Feed!");
          closeShareModal();
      } catch (e) {
          alert("Failed to post.");
      } finally {
          setSharing(false);
      }
  };

  const handleSendToFriend = async (targetUser: User) => {
      if (!studyToShare) return;
      setSharing(true);
      try {
          const me = getCurrentUser();
          // Automatically add to friends list if not already
          if (!me?.friends?.includes(targetUser.id)) {
              await toggleFriend(targetUser.id);
          }

          // "Send" by creating a tagged post (Simulated DM)
          await createPost(`Shared a study with ${targetUser.name}: "${studyToShare.sermonTitle}"`, 'STUDY_SHARE', studyToShare.id);
          
          alert(`Shared with ${targetUser.name} and added to friends!`);
          closeShareModal();
      } catch (e) {
          alert("Failed to share.");
      } finally {
          setSharing(false);
      }
  };

  const handleNativeShare = async () => {
    if (!studyToShare) return;

    const uniqueLink = `https://mychurchbible.app/share/${studyToShare.id}`;
    const shareData = {
        title: studyToShare.sermonTitle,
        text: `Check out this Bible Study: "${studyToShare.sermonTitle}".`,
        url: uniqueLink
    };

    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
            alert("Link copied to clipboard!");
        }
        closeShareModal();
    } catch (err) {
        console.error("Error sharing:", err);
    }
  };

  const filteredUsers = communityUsers.filter(u => 
      u.name.toLowerCase().includes(shareSearch.toLowerCase()) || 
      u.email.toLowerCase().includes(shareSearch.toLowerCase())
  );

  return (
    <div className="p-6 h-full overflow-y-auto pb-24 max-w-md mx-auto relative">
      <h1 className="text-2xl font-serif font-bold mb-6 text-white">Your Studies</h1>

      {loading ? (
          <div className="text-gray-500 text-center mt-10">Loading studies...</div>
      ) : studies.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500 space-y-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <p>No studies yet. Record a sermon to begin.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {studies.map((study) => {
            const completedCount = study.days.filter(d => d.isCompleted).length;
            const totalCount = study.days.length;
            const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
            const isFullyComplete = study.isCompleted || percent === 100;

            return (
                <div
                key={study.id}
                onClick={() => onSelectStudy(study)}
                className={`bg-gray-800 rounded-xl p-5 border transition-all cursor-pointer relative group shadow-lg ${
                    isFullyComplete
                    ? 'border-green-800/50 hover:border-green-600/50' 
                    : 'border-gray-700 hover:border-purple-500/50'
                }`}
                >
                <div className="flex items-start justify-between mb-1">
                    <h3 className="text-lg font-bold text-white leading-snug pr-2">{study.sermonTitle}</h3>
                    <div className="flex items-center space-x-1">
                        <button
                            onClick={(e) => openShareModal(e, study)}
                            className="text-gray-400 hover:text-purple-400 p-1.5 rounded-full hover:bg-gray-700 transition-all"
                        >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                             </svg>
                        </button>
                        <button 
                            onClick={(e) => handleDeleteClick(e, study.id)}
                            className="text-gray-600 hover:text-red-400 p-1.5 rounded-full hover:bg-gray-700 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>
                
                <div className="mb-3">
                    <span className="text-xs font-medium text-gray-400 block">
                        {new Date(study.dateRecorded).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                        {study.preacher && <span className="text-gray-500 italic"> • {study.preacher}</span>}
                    </span>
                </div>
                
                <div className="mt-4">
                    <div className="flex justify-between items-end mb-1.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isFullyComplete ? 'text-green-400' : 'text-purple-400'}`}>
                            {isFullyComplete ? 'Completed' : `${completedCount}/${totalCount} Days Completed`}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">{percent}%</span>
                    </div>
                    <div className="w-full bg-gray-900 rounded-full h-1.5 overflow-hidden border border-gray-800/50">
                        <div 
                            className={`h-full rounded-full transition-all duration-500 ${isFullyComplete ? 'bg-green-500' : 'bg-purple-600'}`} 
                            style={{ width: `${percent}%` }}
                        ></div>
                    </div>
                </div>
                </div>
            );
          })}
        </div>
      )}
      
      {/* FAB (New Study) */}
      <div className="fixed bottom-20 right-6 z-40 flex flex-col items-end space-y-3">
          {showFabMenu && (
              <div className="flex flex-col space-y-3 animate-slide-up">
                  <button 
                    onClick={() => onCreateStudy('UPLOAD_AUDIO')}
                    className="flex items-center bg-gray-800 text-white px-4 py-2 rounded-full shadow-lg border border-gray-700 hover:bg-gray-700 transition-colors"
                  >
                      <span className="text-sm font-medium mr-2">Upload Audio</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                  </button>
                  <button 
                    onClick={() => onCreateStudy('SCAN_NOTES')}
                    className="flex items-center bg-gray-800 text-white px-4 py-2 rounded-full shadow-lg border border-gray-700 hover:bg-gray-700 transition-colors"
                  >
                      <span className="text-sm font-medium mr-2">Scan Notes</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                  </button>
                  <button 
                    onClick={() => onCreateStudy('PASTE_TEXT')}
                    className="flex items-center bg-gray-800 text-white px-4 py-2 rounded-full shadow-lg border border-gray-700 hover:bg-gray-700 transition-colors"
                  >
                      <span className="text-sm font-medium mr-2">Paste Text</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                  </button>
              </div>
          )}
          
          <button 
            onClick={() => setShowFabMenu(!showFabMenu)}
            className="bg-purple-600 text-white rounded-full p-4 shadow-xl border-2 border-purple-500 hover:bg-purple-700 active:scale-95 transition-all"
          >
            {showFabMenu ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
            )}
          </button>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmationId && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in">
              <div className="bg-gray-800 p-6 rounded-2xl max-w-sm w-full border border-gray-700 shadow-xl scale-100 animate-slide-up sm:animate-none">
                  <h3 className="text-xl font-bold text-white mb-2">Delete Study?</h3>
                  <p className="text-gray-400 mb-6 text-sm leading-relaxed">Are you sure you want to remove this study? This action cannot be undone.</p>
                  <div className="flex space-x-3">
                      <button 
                        onClick={() => setDeleteConfirmationId(null)} 
                        className="flex-1 py-3 bg-gray-700 rounded-xl text-white font-medium hover:bg-gray-600 transition-colors"
                      >
                          Cancel
                      </button>
                      <button 
                        onClick={confirmDelete} 
                        className="flex-1 py-3 bg-red-600 rounded-xl text-white font-bold hover:bg-red-700 transition-colors shadow-lg"
                      >
                          Delete
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Share Modal */}
      {shareModalOpen && studyToShare && (
          <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 p-4">
              <div className="bg-gray-800 w-full max-w-sm rounded-2xl overflow-hidden border border-gray-700 shadow-2xl animate-slide-up sm:animate-none">
                  <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                      <h3 className="font-bold text-white">Share Study</h3>
                      <button onClick={closeShareModal} className="text-gray-400 hover:text-white">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                      </button>
                  </div>
                  
                  <div className="p-4 space-y-6">
                      {/* Option 1: Community Feed */}
                      <div>
                          <button 
                            onClick={handlePostToFeed}
                            disabled={sharing}
                            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center transition-all"
                          >
                              {sharing ? (
                                  <span className="animate-pulse">Sharing...</span>
                              ) : (
                                  <>
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                      </svg>
                                      Post to Community Feed
                                  </>
                              )}
                          </button>
                      </div>

                      {/* Option 2: Send to Friend */}
                      <div>
                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Send to Friend (Auto-adds Friend)</h4>
                          <input 
                              type="text" 
                              placeholder="Search users..." 
                              value={shareSearch}
                              onChange={(e) => setShareSearch(e.target.value)}
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 mb-2"
                          />
                          <div className="max-h-40 overflow-y-auto space-y-1 bg-gray-900/50 rounded-lg p-1">
                              {filteredUsers.length === 0 ? (
                                  <p className="text-center text-xs text-gray-500 py-2">No users found.</p>
                              ) : (
                                  filteredUsers.map(u => (
                                      <button 
                                        key={u.id}
                                        onClick={() => handleSendToFriend(u)}
                                        disabled={sharing}
                                        className="w-full flex items-center justify-between p-2 hover:bg-gray-700 rounded-md group transition-colors"
                                      >
                                          <div className="flex items-center">
                                              <div className={`h-6 w-6 rounded-full ${u.avatar || 'bg-gray-600'} flex items-center justify-center text-[10px] font-bold text-white mr-2 overflow-hidden`}>
                                                  {u.avatar?.startsWith('http') ? <img src={u.avatar} className="w-full h-full object-cover" alt="av" /> : u.name[0]}
                                              </div>
                                              <span className="text-sm text-gray-300 font-medium group-hover:text-white">{u.name}</span>
                                          </div>
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-500 opacity-0 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                          </svg>
                                      </button>
                                  ))
                              )}
                          </div>
                      </div>

                      {/* Option 3: Share Link */}
                      <button 
                          onClick={handleNativeShare}
                          className="w-full border border-gray-600 hover:bg-gray-700 text-gray-300 hover:text-white py-3 rounded-xl font-medium transition-colors text-sm flex items-center justify-center"
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                          Share via Link...
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default StudyDashboard;
