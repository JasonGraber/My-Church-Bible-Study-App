import React, { useState, useEffect } from 'react';
import { SermonStudy, AppView, DailyStudy, StudyParticipant, StudyDayComment } from '../types';
import { saveStudy, getStudyParticipants, markStudyDayComplete, unmarkStudyDayComplete, isUserStudyParticipant, getUserProgressForStudy, getStudyDayComments, addStudyDayComment } from '../services/storageService';
import { getCurrentUser } from '../services/authService';

interface StudyDetailProps {
  study: SermonStudy;
  onBack: () => void;
}

// YouVersion OSIS Book Codes Mapping
const BOOK_MAP: Record<string, string> = {
  "genesis": "GEN", "exodus": "EXO", "leviticus": "LEV", "numbers": "NUM", "deuteronomy": "DEU",
  "joshua": "JOS", "judges": "JDG", "ruth": "RUT", "1 samuel": "1SA", "2 samuel": "2SA",
  "1 kings": "1KI", "2 kings": "2KI", "1 chronicles": "1CH", "2 chronicles": "2CH", "ezra": "EZR",
  "nehemiah": "NEH", "esther": "EST", "job": "JOB", "psalm": "PSA", "psalms": "PSA", "proverbs": "PRO",
  "ecclesiastes": "ECC", "song of solomon": "SNG", "song of songs": "SNG", "isaiah": "ISA", "jeremiah": "JER", "lamentations": "LAM",
  "ezekiel": "EZE", "daniel": "DAN", "hosea": "HOS", "joel": "JOE", "amos": "AMO", "obadiah": "OBA",
  "jonah": "JON", "micah": "MIC", "nahum": "NAH", "habakkuk": "HAB", "zephaniah": "ZEP", "haggai": "HAG",
  "zechariah": "ZEC", "malachi": "MAL",
  "matthew": "MAT", "mark": "MRK", "luke": "LUK", "john": "JHN", "acts": "ACT", "romans": "ROM",
  "1 corinthians": "1CO", "2 corinthians": "2CO", "galatians": "GAL", "ephesians": "EPH", "philippians": "PHP",
  "colossians": "COL", "1 thessalonians": "1TH", "2 thessalonians": "2TH", "1 timothy": "1TI", "2 timothy": "2TI",
  "titus": "TIT", "philemon": "PHM", "hebrews": "HEB", "james": "JAS", "1 peter": "1PE", "2 peter": "2PE",
  "1 john": "1JN", "2 john": "2JN", "3 john": "3JN", "jude": "JUD", "revelation": "REV"
};

const StudyDetail: React.FC<StudyDetailProps> = ({ study: initialStudy, onBack }) => {
  const [study, setStudy] = useState<SermonStudy>(initialStudy);
  const [activeDay, setActiveDay] = useState<number>(0);
  const [participants, setParticipants] = useState<StudyParticipant[]>([]);
  const [isParticipant, setIsParticipant] = useState(false);
  const [myProgress, setMyProgress] = useState<number[]>([]);
  const [showParticipants, setShowParticipants] = useState(false);
  const [dayComments, setDayComments] = useState<StudyDayComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  const currentUser = getCurrentUser();
  const isOwner = currentUser?.id === study.userId;

  useEffect(() => {
    setStudy(initialStudy);
  }, [initialStudy]);

  // Load participants and check if current user is a participant
  useEffect(() => {
    const loadParticipantData = async () => {
      const [participantList, isUserParticipant, userProgress] = await Promise.all([
        getStudyParticipants(study.id),
        isUserStudyParticipant(study.id),
        getUserProgressForStudy(study.id)
      ]);
      setParticipants(participantList);
      setIsParticipant(isUserParticipant);
      setMyProgress(userProgress);
    };
    loadParticipantData();
  }, [study.id]);

  // Load comments for current day
  useEffect(() => {
    const loadComments = async () => {
      const currentDayNumber = study.days[activeDay]?.day;
      if (currentDayNumber) {
        const comments = await getStudyDayComments(study.id, currentDayNumber);
        setDayComments(comments);
      }
    };
    loadComments();
  }, [study.id, activeDay]);

  if (!study) return null;

  const currentDay = study.days[activeDay];

  const handleToggleDayComplete = async () => {
    const currentDayNumber = study.days[activeDay].day;
    const wasCompleted = study.days[activeDay].isCompleted;

    const updatedDays = study.days.map((d, idx) => {
        if (idx === activeDay) {
            return { ...d, isCompleted: !d.isCompleted };
        }
        return d;
    });

    const allComplete = updatedDays.every(d => d.isCompleted);

    const updatedStudy = {
        ...study,
        days: updatedDays,
        isCompleted: allComplete
    };

    setStudy(updatedStudy);

    // If user is owner, save to their study record
    if (isOwner) {
      await saveStudy(updatedStudy);
    }

    // If user is a participant (or owner with participants), sync to participant progress
    if (isParticipant || participants.length > 0) {
      if (wasCompleted) {
        await unmarkStudyDayComplete(study.id, currentDayNumber);
        setMyProgress(prev => prev.filter(d => d !== currentDayNumber));
      } else {
        await markStudyDayComplete(study.id, currentDayNumber);
        setMyProgress(prev => [...prev, currentDayNumber]);
      }
      // Refresh participants to show updated progress
      const updated = await getStudyParticipants(study.id);
      setParticipants(updated);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim() || postingComment) return;
    setPostingComment(true);
    try {
      const currentDayNumber = study.days[activeDay].day;
      const result = await addStudyDayComment(
        study.id,
        currentDayNumber,
        newComment.trim(),
        study.sermonTitle,
        true // Post to community feed
      );
      if (result) {
        setDayComments(prev => [...prev, result]);
        setNewComment('');
      }
    } catch (e) {
      console.error("Failed to post comment:", e);
    } finally {
      setPostingComment(false);
    }
  };

  const createYouVersionLink = (reference: string) => {
    if (!reference) return "#";

    // Basic cleaning
    const cleanRef = reference.trim().replace(/[()]/g, '');

    // Try to parse "Book Chapter:Verse"
    // Regex looks for: (Optional Number + Space + Word + Space + Word OR Word) + Space + Number + : + Number
    // E.g. "1 John 1:9", "John 3:16", "Song of Solomon 2:1"
    const match = cleanRef.match(/^((?:\d\s)?[a-zA-Z\s]+)\s(\d+):(\d+)(?:-\d+)?$/);

    if (match) {
      const bookName = match[1].trim().toLowerCase();
      const chapter = match[2];
      const verse = match[3];
      
      const osisCode = BOOK_MAP[bookName];
      if (osisCode) {
        // Version 111 is NIV. 1 is KJV. 59 is ESV.
        // Format: https://www.bible.com/bible/111/JHN.3.16
        return `https://www.bible.com/bible/111/${osisCode}.${chapter}.${verse}`;
      }
    }
    
    // Fallback to search if parsing fails
    return `https://www.bible.com/search/bible?q=${encodeURIComponent(cleanRef)}`;
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 relative pb-20">
      {/* Header */}
      <div className="px-6 py-6 bg-gradient-to-b from-gray-800 to-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="flex justify-between items-start mb-4">
            <button onClick={onBack} className="flex items-center text-gray-400 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
            </button>
            {study.isCompleted && (
                <span className="bg-green-900/40 text-green-400 text-[10px] font-bold px-2 py-1 rounded border border-green-800 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    STUDY COMPLETE
                </span>
            )}
        </div>
        <h1 className="text-2xl font-serif font-bold text-white leading-tight">{study.sermonTitle}</h1>
        <p className="text-sm text-purple-400 mt-1">{study.preacher}</p>

        {/* Participants indicator */}
        {participants.length > 0 && (
          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className="mt-3 flex items-center text-gray-400 hover:text-white transition-colors"
          >
            <div className="flex -space-x-2 mr-2">
              {participants.slice(0, 4).map((p, i) => (
                <div
                  key={p.id}
                  className="w-6 h-6 rounded-full border-2 border-gray-800 bg-gray-600 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden"
                  style={{ zIndex: 4 - i }}
                >
                  {p.userAvatar?.startsWith('http') ? (
                    <img src={p.userAvatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    p.userName?.[0]?.toUpperCase() || '?'
                  )}
                </div>
              ))}
              {participants.length > 4 && (
                <div className="w-6 h-6 rounded-full border-2 border-gray-800 bg-purple-600 flex items-center justify-center text-[10px] font-bold text-white">
                  +{participants.length - 4}
                </div>
              )}
            </div>
            <span className="text-xs">{participants.length + 1} studying together</span>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ml-1 transition-transform ${showParticipants ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Participants Panel */}
      {showParticipants && participants.length > 0 && (
        <div className="bg-gray-800/80 border-b border-gray-700 p-4">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Study Participants</h4>
          <div className="space-y-3">
            {/* Owner */}
            {isOwner && currentUser && (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-sm font-bold text-white overflow-hidden mr-3 ring-2 ring-purple-500">
                    {currentUser.avatar?.startsWith('http') ? (
                      <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      currentUser.name?.[0]?.toUpperCase() || '?'
                    )}
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{currentUser.name} <span className="text-purple-400 text-xs">(You - Owner)</span></p>
                  </div>
                </div>
                <div className="flex items-center text-xs text-gray-400">
                  <span className="mr-1">{study.days.filter(d => d.isCompleted).length}/{study.days.length}</span>
                  <div className="flex">
                    {study.days.map((d, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full mx-0.5 ${d.isCompleted ? 'bg-green-500' : 'bg-gray-600'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Participants */}
            {participants.map(p => (
              <div key={p.id} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-sm font-bold text-white overflow-hidden mr-3">
                    {p.userAvatar?.startsWith('http') ? (
                      <img src={p.userAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      p.userName?.[0]?.toUpperCase() || '?'
                    )}
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">
                      {p.userName}
                      {currentUser?.id === p.userId && <span className="text-purple-400 text-xs ml-1">(You)</span>}
                    </p>
                    <p className="text-gray-500 text-xs">Joined {new Date(p.joinedAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center text-xs text-gray-400">
                  <span className="mr-1">{p.completedDays.length}/{study.days.length}</span>
                  <div className="flex">
                    {study.days.map((d, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full mx-0.5 ${p.completedDays.includes(d.day) ? 'bg-green-500' : 'bg-gray-600'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Day Scroller */}
      <div className="flex overflow-x-auto py-4 px-6 space-x-3 no-scrollbar border-b border-gray-800 bg-gray-900/95 backdrop-blur sticky top-[120px] z-10">
        {study.days.map((day, index) => (
          <button
            key={day.day}
            onClick={() => setActiveDay(index)}
            className={`flex-shrink-0 flex flex-col items-center justify-center w-14 h-16 rounded-lg border transition-all relative ${
              activeDay === index
                ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/50'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
            }`}
          >
            {day.isCompleted && (
                <div className={`absolute -top-1.5 -right-1.5 rounded-full p-0.5 ${activeDay === index ? 'bg-white text-purple-600' : 'bg-green-500 text-gray-900'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                </div>
            )}
            <span className="text-[10px] font-medium uppercase opacity-80">Day</span>
            <span className="text-xl font-bold">{day.day}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-md mx-auto w-full">
        <div className="space-y-8 animate-fade-in">
            
            {/* Title & Scripture */}
            <div className="text-center space-y-3">
                <h2 className="text-xl font-bold text-white">{currentDay.topic}</h2>
                
                {/* Main Scripture Link */}
                <a 
                    href={createYouVersionLink(currentDay.scriptureReference)} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center bg-gray-800 px-4 py-1.5 rounded-full border border-gray-700 hover:border-purple-500 transition-colors group"
                >
                    <span className="text-purple-400 font-serif italic mr-2">{currentDay.scriptureReference}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-500 group-hover:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                </a>
            </div>

            {/* Devotional */}
            <div className="prose prose-invert prose-p:text-gray-300 prose-lg">
                <p className="font-serif leading-relaxed text-lg">
                    {currentDay.devotionalContent}
                </p>
            </div>

            <hr className="border-gray-800" />

            {/* Supporting Scriptures */}
            {currentDay.supportingScriptures && currentDay.supportingScriptures.length > 0 && (
                <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700/30">
                     <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Supporting Scriptures</h3>
                     <div className="flex flex-wrap gap-2">
                        {currentDay.supportingScriptures.map((ref, idx) => (
                            <a 
                                key={idx}
                                href={createYouVersionLink(ref)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs bg-gray-800 hover:bg-gray-700 text-purple-300 px-3 py-1.5 rounded border border-gray-700 transition-colors"
                            >
                                {ref}
                            </a>
                        ))}
                     </div>
                </div>
            )}

            {/* Reflection */}
            <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700/50">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    Reflection
                </h3>
                <p className="text-white italic text-lg">"{currentDay.reflectionQuestion}"</p>
            </div>

            {/* Prayer */}
            <div className="bg-purple-900/20 p-6 rounded-2xl border border-purple-900/50">
                <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider mb-3 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    Prayer
                </h3>
                <p className="text-gray-200">{currentDay.prayerFocus}</p>
            </div>

            {/* Day Completion Toggle */}
            <button
                onClick={handleToggleDayComplete}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all shadow-lg flex items-center justify-center space-x-2 ${
                    currentDay.isCompleted
                    ? 'bg-green-900/20 text-green-400 border border-green-800 hover:bg-green-900/30'
                    : 'bg-white text-gray-900 hover:bg-gray-100'
                }`}
            >
                {currentDay.isCompleted ? (
                    <>
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                         </svg>
                         <span>Day {currentDay.day} Completed</span>
                    </>
                ) : (
                    <span>Mark Day {currentDay.day} Complete</span>
                )}
            </button>

            {/* Day Comments Section */}
            <div className="mt-8 border-t border-gray-800 pt-6">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
                Day {currentDay.day} Discussion
                {dayComments.length > 0 && <span className="ml-2 text-purple-400">({dayComments.length})</span>}
              </h3>

              {/* Comments List */}
              {dayComments.length > 0 && (
                <div className="space-y-4 mb-4">
                  {dayComments.map(comment => (
                    <div key={comment.id} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-sm font-bold text-white overflow-hidden flex-shrink-0">
                          {comment.userAvatar?.startsWith('http') ? (
                            <img src={comment.userAvatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            comment.userName?.[0]?.toUpperCase() || '?'
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-white font-medium text-sm">{comment.userName}</span>
                            <span className="text-gray-500 text-xs">
                              {new Date(comment.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <p className="text-gray-300 text-sm mt-1">{comment.comment}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Comment */}
              <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/30">
                <p className="text-xs text-gray-500 mb-2">Share your thoughts on today's study (will post to your Community feed)</p>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Share a reflection..."
                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                    onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
                  />
                  <button
                    onClick={handlePostComment}
                    disabled={!newComment.trim() || postingComment}
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                  >
                    {postingComment ? '...' : 'Post'}
                  </button>
                </div>
              </div>
            </div>

            <div className="h-8"></div>
        </div>
      </div>
    </div>
  );
};

export default StudyDetail;