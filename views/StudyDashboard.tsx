import React, { useState, useEffect } from 'react';
import { SermonStudy } from '../types';
import { getStudies, deleteStudy } from '../services/storageService';

interface StudyDashboardProps {
  onSelectStudy: (study: SermonStudy) => void;
  onCreateStudy: (action: 'UPLOAD_AUDIO' | 'SCAN_NOTES' | 'PASTE_TEXT') => void;
}

const StudyDashboard: React.FC<StudyDashboardProps> = ({ onSelectStudy, onCreateStudy }) => {
  const [studies, setStudies] = useState<SermonStudy[]>([]);
  const [showFabMenu, setShowFabMenu] = useState(false);

  const loadStudies = () => {
      setStudies(getStudies());
  }

  useEffect(() => {
    loadStudies();
  }, []);

  const handleDelete = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if(confirm("Are you sure you want to delete this study?")) {
          deleteStudy(id);
          loadStudies();
      }
  }

  const handleShare = async (e: React.MouseEvent, study: SermonStudy) => {
    e.stopPropagation();
    
    // Simulate a unique link - in a real app this would be a DB ID
    const uniqueLink = `https://mychurchbible.app/share/${study.id}`;
    
    const shareData = {
        title: study.sermonTitle,
        text: `Check out this Bible Study: "${study.sermonTitle}"${study.preacher ? ` by ${study.preacher}` : ''}. \n\nSummary: ${study.days[0]?.devotionalContent.substring(0, 100)}...`,
        url: uniqueLink
    };

    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            // Fallback for desktop or browsers without share API
            await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
            alert("Link and summary copied to clipboard!");
        }
    } catch (err) {
        console.error("Error sharing:", err);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto pb-24 max-w-md mx-auto relative">
      <h1 className="text-2xl font-serif font-bold mb-6 text-white">Your Studies</h1>

      {studies.length === 0 ? (
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
                        {/* Share Button */}
                        <button
                            onClick={(e) => handleShare(e, study)}
                            className="text-gray-400 hover:text-purple-400 p-1.5 rounded-full hover:bg-gray-700 transition-all"
                            title="Share Study"
                        >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                             </svg>
                        </button>

                        {/* Delete Button */}
                        <button 
                            onClick={(e) => handleDelete(e, study.id)}
                            className="text-gray-600 hover:text-red-400 p-1.5 rounded-full hover:bg-gray-700 transition-colors"
                            title="Delete Study"
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
                
                {/* Progress Section */}
                <div className="mt-4">
                    <div className="flex justify-between items-end mb-1.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isFullyComplete ? 'text-green-400' : 'text-purple-400'}`}>
                            {isFullyComplete ? (
                                <span className="flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Completed
                                </span>
                            ) : (
                                `${completedCount}/${totalCount} Days Completed`
                            )}
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

      {/* Floating Action Button (New Study) */}
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

    </div>
  );
};

export default StudyDashboard;