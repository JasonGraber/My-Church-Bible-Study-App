
import React, { useState, useEffect } from 'react';
import { User, Post } from '../types';
import { getUserById, toggleFriend, getCurrentUser } from '../services/authService';
import { getPostsByUserId } from '../services/storageService';
import { toggleLikePost } from '../services/socialService';

interface ProfileViewProps {
  userId: string;
  onBack: () => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ userId, onBack }) => {
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    const user = await getUserById(userId);
    const userPosts = await getPostsByUserId(userId);
    const me = getCurrentUser();

    setProfileUser(user || null);
    setPosts(userPosts);
    setCurrentUser(me);
    setLoading(false);
  };

  const handleToggleFriend = async () => {
    if (!profileUser) return;
    const updatedMe = await toggleFriend(profileUser.id);
    if (updatedMe) {
        setCurrentUser(updatedMe); // Update local state to reflect friendship change
    }
  };

  const handleLike = (post: Post) => {
      const updatedPost = toggleLikePost(post);
      setPosts(prev => prev.map(p => p.id === post.id ? updatedPost : p));
  };

  if (loading) return <div className="p-10 text-center text-gray-500">Loading Profile...</div>;
  if (!profileUser) return <div className="p-10 text-center text-red-400">User not found</div>;

  const isMe = currentUser?.id === profileUser.id;
  const isFriend = currentUser?.friends?.includes(profileUser.id);

  return (
    <div className="h-full bg-gray-900 overflow-y-auto pb-24">
      {/* Navbar Style Header */}
      <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-4 flex items-center z-10">
        <button 
          onClick={onBack}
          className="flex items-center text-gray-400 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="ml-4 text-lg font-bold text-white">Profile</h1>
      </div>

      {/* Profile Header */}
      <div className="p-6 pb-2 border-b border-gray-800">
        <div className="flex flex-col items-center">
             <div className={`h-24 w-24 rounded-full ${profileUser.avatar || 'bg-gray-600'} flex items-center justify-center text-white text-3xl font-bold mb-4 border-4 border-gray-800 shadow-xl`}>
                {profileUser.avatar?.startsWith('http') ? (
                    <img src={profileUser.avatar} alt="av" className="w-full h-full rounded-full object-cover" />
                ) : (
                    profileUser.name[0]
                )}
             </div>
             <h2 className="text-2xl font-bold text-white">{profileUser.name}</h2>
             <p className="text-sm text-gray-500 mb-2">{profileUser.email}</p>
             
             {profileUser.bio && (
                 <p className="text-center text-gray-300 text-sm max-w-xs mb-4 italic">
                     "{profileUser.bio}"
                 </p>
             )}

             <div className="flex space-x-6 text-center mb-6">
                 <div>
                     <span className="block font-bold text-white text-lg">{posts.length}</span>
                     <span className="text-xs text-gray-500 uppercase">Posts</span>
                 </div>
                 <div>
                     <span className="block font-bold text-white text-lg">{profileUser.friends?.length || 0}</span>
                     <span className="text-xs text-gray-500 uppercase">Friends</span>
                 </div>
             </div>

             {!isMe && (
                 <button
                    onClick={handleToggleFriend}
                    className={`w-full max-w-xs py-2 rounded-lg font-bold text-sm transition-colors ${
                        isFriend 
                        ? 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-red-900/20 hover:text-red-400 hover:border-red-900' 
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                 >
                     {isFriend ? 'Following' : 'Follow'}
                 </button>
             )}
        </div>
      </div>

      {/* Posts Grid/List */}
      <div className="p-0">
          <div className="p-4 bg-gray-900 sticky top-[60px] z-0">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Activity</h3>
          </div>
          
          {posts.length === 0 ? (
              <div className="p-8 text-center">
                  <p className="text-gray-500 italic text-sm">No posts yet.</p>
              </div>
          ) : (
              <div className="space-y-2">
                  {posts.map(post => (
                      <div key={post.id} className="bg-gray-800/50 p-4 border-b border-gray-800">
                          <p className="text-sm text-gray-200 mb-2">{post.content}</p>
                           {post.studyId && (
                                <div className="bg-gray-900 rounded p-2 mb-2 border border-gray-800 flex items-center">
                                    <div className="h-8 w-8 bg-purple-900/30 rounded flex items-center justify-center mr-2 text-purple-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                        </svg>
                                    </div>
                                    <span className="text-xs text-gray-400">Shared a Study Plan</span>
                                </div>
                            )}
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <span>{new Date(post.timestamp).toLocaleDateString()}</span>
                              <button onClick={() => handleLike(post)} className={`flex items-center space-x-1 ${post.isLikedByCurrentUser ? 'text-red-400' : ''}`}>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                                  </svg>
                                  {post.likes}
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          )}
      </div>
    </div>
  );
};

export default ProfileView;