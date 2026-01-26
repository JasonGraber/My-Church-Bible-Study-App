
import React, { useState, useEffect } from 'react';
import { Post, User } from '../types';
import { getFeed, toggleLikePost, commentOnPost } from '../services/socialService';
import { getCommunityUsers, toggleFriend, getCurrentUser } from '../services/authService';
import { joinStudy } from '../services/storageService';

interface CommunityViewProps {
    onViewProfile?: (userId: string) => void;
}

const CommunityView: React.FC<CommunityViewProps> = ({ onViewProfile }) => {
    const [activeTab, setActiveTab] = useState<'feed' | 'people'>('feed');
    const [posts, setPosts] = useState<Post[]>([]);
    const [people, setPeople] = useState<User[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Comment State
    const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
    const [commentInput, setCommentInput] = useState("");
    const [submittingMap, setSubmittingMap] = useState<Record<string, boolean>>({});
    
    // Join Study State
    const [joiningMap, setJoiningMap] = useState<Record<string, boolean>>({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const feedData = await getFeed();
        const peopleData = await getCommunityUsers();
        const user = getCurrentUser();
        
        setPosts(feedData);
        setPeople(peopleData);
        setCurrentUser(user);
        setLoading(false);
    };

    const handleLike = (post: Post) => {
        const updatedPost = toggleLikePost(post);
        setPosts(prev => prev.map(p => p.id === post.id ? updatedPost : p));
    };

    const handleToggleComments = (postId: string) => {
        if (expandedPostId === postId) {
            setExpandedPostId(null);
        } else {
            setExpandedPostId(postId);
            setCommentInput("");
        }
    };

    const handleSubmitComment = async (postId: string) => {
        if (!commentInput.trim() || submittingMap[postId]) return;
        
        setSubmittingMap(prev => ({...prev, [postId]: true}));

        try {
            const updatedPost = await commentOnPost(postId, commentInput);
            setPosts(prev => prev.map(p => p.id === postId ? updatedPost : p));
            setCommentInput("");
        } catch (e) {
            alert("Failed to post comment");
        } finally {
            setSubmittingMap(prev => ({...prev, [postId]: false}));
        }
    };

    const handleToggleFriend = async (userId: string) => {
        const updatedUser = await toggleFriend(userId);
        if (updatedUser) {
            setCurrentUser(updatedUser);
        }
    };

    const handleJoinStudy = async (studyId: string) => {
        if (joiningMap[studyId]) return;
        setJoiningMap(prev => ({ ...prev, [studyId]: true }));
        try {
            await joinStudy(studyId);
            alert("Study joined! It has been added to your dashboard.");
        } catch (e: any) {
            console.error(e);
            alert("Failed to join study: " + e.message);
        } finally {
            setJoiningMap(prev => ({ ...prev, [studyId]: false }));
        }
    };

    const handleInvite = async () => {
        const shareData = {
            title: 'Join My Church Bible Study',
            text: 'I\'m using this app to generate bible studies from Sunday sermons. Join me!',
            url: window.location.href
        };
        
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                throw new Error("Share API unavailable");
            }
        } catch (e) {
            // Fallback to clipboard
            try {
                await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
                alert("Invite link copied to clipboard!");
            } catch (err) {
                alert("Could not automatically copy link. Please share this URL: " + window.location.href);
            }
        }
    };

    const handleUserClick = (userId: string) => {
        if (onViewProfile) {
            onViewProfile(userId);
        }
    }

    const isFriend = (userId: string) => {
        return currentUser?.friends?.includes(userId);
    };

    const isOwnPost = (userId: string) => {
        return currentUser?.id === userId;
    };

    const isStudyOwner = (post: Post) => {
        // Check if current user owns the study (via studyData.ownerId or if they made the original share)
        return currentUser?.id === post.studyData?.ownerId || currentUser?.id === post.userId;
    };

    // Filter feed to only show posts from friends and own posts
    const filteredPosts = posts.filter(post =>
        isOwnPost(post.userId) || isFriend(post.userId)
    );

    const hasFriends = currentUser?.friends && currentUser.friends.length > 0;

    return (
        <div className="p-0 h-full overflow-y-auto pb-24 max-w-md mx-auto bg-gray-900 relative">
            {/* Header */}
            <div className="px-6 py-4 bg-gray-900 sticky top-0 z-10 border-b border-gray-800 flex justify-between items-center">
                <h1 className="text-2xl font-serif font-bold text-white">Community</h1>
                <div className="flex space-x-1 bg-gray-800 p-1 rounded-lg">
                    <button 
                        onClick={() => setActiveTab('feed')}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'feed' ? 'bg-purple-600 text-white shadow' : 'text-gray-400'}`}
                    >
                        Feed
                    </button>
                    <button 
                        onClick={() => setActiveTab('people')}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${activeTab === 'people' ? 'bg-purple-600 text-white shadow' : 'text-gray-400'}`}
                    >
                        People
                    </button>
                </div>
            </div>

            {/* Content */}
            {activeTab === 'feed' ? (
                <>
                    {/* Feed */}
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Loading feed...</div>
                    ) : !hasFriends ? (
                        /* Empty state when user has no friends */
                        <div className="p-8 text-center">
                            <div className="bg-gray-800/50 rounded-2xl p-8 border border-gray-700 max-w-sm mx-auto">
                                <div className="h-16 w-16 bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-white font-bold text-lg mb-2">Connect with Friends</h3>
                                <p className="text-gray-400 text-sm mb-6">Add friends to see their Bible studies and share your journey together.</p>
                                <button
                                    onClick={() => setActiveTab('people')}
                                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-3 rounded-xl transition-colors"
                                >
                                    Find Friends
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="pb-4">
                            {filteredPosts.length === 0 ? (
                                <div className="p-12 text-center text-gray-600 italic">No posts from friends yet. Check back soon!</div>
                            ) : filteredPosts.map(post => (
                                <div key={post.id} className="border-b border-gray-800 bg-gray-900 mb-2">
                                    {/* Post Header */}
                                    <div className="flex items-center p-4">
                                        <button 
                                            onClick={() => handleUserClick(post.userId)}
                                            className={`h-10 w-10 rounded-full ${post.userAvatar || 'bg-gray-600'} mr-3 flex items-center justify-center text-white font-bold relative overflow-hidden`}
                                        >
                                            {post.userAvatar?.startsWith('http') ? (
                                                <img src={post.userAvatar} alt="av" className="w-full h-full object-cover"/>
                                            ) : (
                                                post.userName[0]
                                            )}
                                        </button>
                                        <div>
                                            <button 
                                                onClick={() => handleUserClick(post.userId)}
                                                className="text-sm font-bold text-white flex items-center hover:underline"
                                            >
                                                {post.userName}
                                                {isFriend(post.userId) && (
                                                    <span className="ml-2 text-[10px] bg-gray-800 text-gray-400 px-1.5 rounded border border-gray-700 no-underline">Friend</span>
                                                )}
                                            </button>
                                            <p className="text-xs text-gray-500">
                                                {post.type === 'STUDY_SHARE' ? 'Shared a study' : post.type === 'PRAYER_REQUEST' ? 'Prayer Request' : 'Update'} • {new Date(post.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Post Content */}
                                    <div className="px-4 pb-2">
                                        <p className="text-gray-200 text-sm leading-relaxed mb-3">{post.content}</p>
                                        
                                        {post.studyId && (
                                            <div className="mt-3 bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-purple-500/50 transition-all group relative overflow-hidden">
                                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-purple-500 transform rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                    </svg>
                                                </div>
                                                
                                                <div className="flex items-start justify-between relative z-10">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="h-12 w-12 bg-purple-900/50 rounded-lg flex items-center justify-center text-purple-400 border border-purple-500/30 flex-shrink-0">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                            </svg>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-purple-400 uppercase tracking-wide mb-0.5">Bible Study Plan</p>
                                                            <h3 className="text-white font-bold leading-tight truncate">{post.studyData?.title || "Sermon Study"}</h3>
                                                            {post.studyData?.preacher && <p className="text-xs text-gray-500 italic mt-0.5 truncate">{post.studyData.preacher}</p>}
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Only show Join button if user doesn't own the study */}
                                                {!isStudyOwner(post) && (
                                                    <div className="mt-4 flex items-center justify-between relative z-10 border-t border-gray-700/50 pt-3">
                                                        <span className="text-xs text-gray-400">Join to add to your studies</span>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleJoinStudy(post.studyId!); }}
                                                            disabled={joiningMap[post.studyId!]}
                                                            className="bg-white text-gray-900 text-xs font-bold px-4 py-1.5 rounded-full hover:bg-gray-200 transition-colors shadow-sm disabled:opacity-70 flex items-center"
                                                        >
                                                            {joiningMap[post.studyId!] ? (
                                                                <>
                                                                    <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-gray-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                    </svg>
                                                                    Joining...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                                    </svg>
                                                                    Join Study
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="px-4 py-3 flex items-center space-x-6 border-b border-gray-800/50">
                                        <button 
                                            onClick={() => handleLike(post)}
                                            className={`flex items-center space-x-1.5 text-sm transition-colors ${post.isLikedByCurrentUser ? 'text-red-500' : 'text-gray-400 hover:text-white'}`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${post.isLikedByCurrentUser ? 'fill-current' : 'fill-none'}`} viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                            </svg>
                                            <span>{post.likes}</span>
                                        </button>
                                        
                                        <button 
                                            onClick={() => handleToggleComments(post.id)}
                                            className={`flex items-center space-x-1.5 text-sm transition-colors ${expandedPostId === post.id ? 'text-blue-400' : 'text-gray-400 hover:text-white'}`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                            </svg>
                                            <span>{post.comments?.length || 0}</span>
                                        </button>
                                    </div>

                                    {/* Comments Section */}
                                    {expandedPostId === post.id && (
                                        <div className="bg-gray-800/30 p-4 animate-fade-in">
                                            {post.comments && post.comments.length > 0 ? (
                                                <div className="space-y-3 mb-4">
                                                    {post.comments.map(comment => (
                                                        <div key={comment.id} className="flex items-start space-x-2">
                                                            <button 
                                                                onClick={() => handleUserClick(comment.userId)}
                                                                className={`h-6 w-6 rounded-full flex-shrink-0 ${comment.userAvatar || 'bg-gray-600'} flex items-center justify-center text-[10px] font-bold text-white overflow-hidden`}
                                                            >
                                                                {comment.userAvatar?.startsWith('http') ? (
                                                                    <img src={comment.userAvatar} alt="av" className="w-full h-full object-cover"/>
                                                                ) : (
                                                                    comment.userName[0]
                                                                )}
                                                            </button>
                                                            <div className="bg-gray-800 rounded-lg p-2 flex-1 border border-gray-700">
                                                                <button onClick={() => handleUserClick(comment.userId)} className="text-xs font-bold text-gray-300 hover:underline">{comment.userName}</button>
                                                                <p className="text-sm text-gray-200">{comment.text}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-gray-500 mb-4 text-center italic">No comments yet. Be the first!</p>
                                            )}

                                            <div className="flex space-x-2">
                                                <input 
                                                    type="text" 
                                                    value={commentInput}
                                                    onChange={(e) => setCommentInput(e.target.value)}
                                                    placeholder="Write a comment..." 
                                                    disabled={submittingMap[post.id]}
                                                    className="flex-1 bg-gray-800 border border-gray-700 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
                                                    onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment(post.id)}
                                                />
                                                <button 
                                                    onClick={() => handleSubmitComment(post.id)}
                                                    disabled={!commentInput.trim() || submittingMap[post.id]}
                                                    className="bg-purple-600 text-white p-2 rounded-full disabled:opacity-50 hover:bg-purple-700 transition-colors"
                                                >
                                                    {submittingMap[post.id] ? (
                                                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                </div>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <div className="p-4 space-y-6">
                    {/* Invite Friend */}
                    <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-4 flex justify-between items-center">
                        <div>
                            <h3 className="text-white font-bold">Invite a Friend</h3>
                            <p className="text-xs text-gray-400">Share the app to connect with your small group.</p>
                        </div>
                        <button onClick={handleInvite} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                            Invite
                        </button>
                    </div>

                    {/* Friends List */}
                    <div>
                        <h2 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-3">Your Friends</h2>
                        {people.filter(u => isFriend(u.id)).length === 0 ? (
                            <p className="text-sm text-gray-500 italic">You haven't added any friends yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {people.filter(u => isFriend(u.id)).map(friend => (
                                    <div key={friend.id} className="flex items-center justify-between bg-gray-800 p-3 rounded-xl border border-gray-700">
                                        <div className="flex items-center">
                                            <button 
                                                onClick={() => handleUserClick(friend.id)}
                                                className={`h-10 w-10 rounded-full ${friend.avatar || 'bg-gray-600'} flex items-center justify-center text-white font-bold mr-3 overflow-hidden`}
                                            >
                                                {friend.avatar?.startsWith('http') ? (
                                                    <img src={friend.avatar} alt="av" className="w-full h-full object-cover"/>
                                                ) : (
                                                    friend.name[0]
                                                )}
                                            </button>
                                            <button onClick={() => handleUserClick(friend.id)} className="text-white font-medium hover:underline">{friend.name}</button>
                                        </div>
                                        <button 
                                            onClick={() => handleToggleFriend(friend.id)}
                                            className="text-xs bg-gray-700 hover:bg-red-900/30 text-gray-300 hover:text-red-400 px-3 py-1.5 rounded transition-colors"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Suggestions */}
                    <div>
                        <h2 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-3">Suggested for you</h2>
                         <div className="space-y-3">
                            {people.filter(u => !isFriend(u.id)).map(person => (
                                <div key={person.id} className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <button 
                                            onClick={() => handleUserClick(person.id)}
                                            className={`h-10 w-10 rounded-full ${person.avatar || 'bg-gray-600'} flex items-center justify-center text-white font-bold mr-3 overflow-hidden`}
                                        >
                                            {person.avatar?.startsWith('http') ? (
                                                <img src={person.avatar} alt="av" className="w-full h-full object-cover"/>
                                            ) : (
                                                person.name[0]
                                            )}
                                        </button>
                                        <div>
                                            <button onClick={() => handleUserClick(person.id)} className="text-white font-medium block hover:underline text-left">{person.name}</button>
                                            <span className="text-xs text-gray-500">Suggested profile</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleToggleFriend(person.id)}
                                        className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded transition-colors"
                                    >
                                        Add Friend
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
};

export default CommunityView;
