import React, { useState, useEffect } from 'react';
import { Post } from '../types';
import { getFeed, toggleLikePost } from '../services/socialService';

const CommunityView: React.FC = () => {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const data = await getFeed();
            setPosts(data);
            setLoading(false);
        };
        load();
    }, []);

    const handleLike = (post: Post) => {
        const updatedPost = toggleLikePost(post);
        setPosts(prev => prev.map(p => p.id === post.id ? updatedPost : p));
    };

    return (
        <div className="p-0 h-full overflow-y-auto pb-24 max-w-md mx-auto bg-gray-900 relative">
            {/* Header */}
            <div className="px-6 py-4 bg-gray-900 sticky top-0 z-10 border-b border-gray-800 flex justify-between items-center">
                <h1 className="text-2xl font-serif font-bold text-white">Community</h1>
                <div className="h-8 w-8 bg-purple-600 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-gray-800">
                    You
                </div>
            </div>

            {/* Stories / Events Highlight Bar */}
            <div className="px-6 py-4 overflow-x-auto whitespace-nowrap no-scrollbar space-x-3 border-b border-gray-800 bg-gray-900">
                <div className="inline-flex flex-col items-center space-y-1">
                    <div className="w-14 h-14 rounded-full border-2 border-purple-500 p-0.5">
                         <div className="w-full h-full bg-gray-700 rounded-full flex items-center justify-center text-xl">➕</div>
                    </div>
                    <span className="text-[10px] text-gray-400">Add Story</span>
                </div>
                {['Youth Retreat', 'Worship Night', 'Picnic', 'Baptism'].map((ev, i) => (
                    <div key={i} className="inline-flex flex-col items-center space-y-1">
                        <div className="w-14 h-14 rounded-full border-2 border-green-500 p-0.5">
                             <div className={`w-full h-full rounded-full flex items-center justify-center text-xs font-bold text-gray-900 bg-gradient-to-br from-green-300 to-green-600`}>
                                 {ev[0]}
                             </div>
                        </div>
                        <span className="text-[10px] text-gray-400">{ev}</span>
                    </div>
                ))}
            </div>

            {/* Feed */}
            {loading ? (
                <div className="p-8 text-center text-gray-500">Loading feed...</div>
            ) : (
                <div className="pb-4">
                    {posts.map(post => (
                        <div key={post.id} className="border-b border-gray-800 bg-gray-900 mb-2">
                            {/* Post Header */}
                            <div className="flex items-center p-4">
                                <div className={`h-10 w-10 rounded-full ${post.userAvatar || 'bg-gray-600'} mr-3 flex items-center justify-center text-white font-bold`}>
                                    {post.userName[0]}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">{post.userName}</p>
                                    <p className="text-xs text-gray-500">
                                        {post.type === 'STUDY_SHARE' ? 'Shared a study' : post.type === 'PRAYER_REQUEST' ? 'Prayer Request' : 'Update'} • {new Date(post.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                    </p>
                                </div>
                            </div>

                            {/* Post Content */}
                            <div className="px-4 pb-2">
                                <p className="text-gray-200 text-sm leading-relaxed mb-3">{post.content}</p>
                                
                                {post.studyId && (
                                    <div className="bg-gray-800 rounded-lg p-3 mb-2 border border-gray-700 flex items-center">
                                        <div className="h-10 w-10 bg-purple-900/50 rounded flex items-center justify-center mr-3 text-purple-400">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-purple-300">Bible Study Plan</p>
                                            <p className="text-xs text-gray-500">Tap to view details</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="px-4 py-3 flex items-center space-x-6">
                                <button 
                                    onClick={() => handleLike(post)}
                                    className={`flex items-center space-x-1.5 text-sm transition-colors ${post.isLikedByCurrentUser ? 'text-red-500' : 'text-gray-400 hover:text-white'}`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${post.isLikedByCurrentUser ? 'fill-current' : 'fill-none'}`} viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                    </svg>
                                    <span>{post.likes}</span>
                                </button>
                                
                                <button className="flex items-center space-x-1.5 text-sm text-gray-400 hover:text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    <span>Comment</span>
                                </button>
                                
                                <button className="flex items-center space-x-1.5 text-sm text-gray-400 hover:text-white ml-auto">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CommunityView;