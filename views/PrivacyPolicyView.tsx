import React from 'react';

interface PrivacyPolicyViewProps {
  onBack: () => void;
}

// Keep this text in step with website/privacy.html.
const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = ({ onBack }) => {
  return (
    <div className="h-full overflow-y-auto bg-gray-900 text-gray-300">
      <div className="sticky top-0 bg-gray-900/95 border-b border-gray-800 px-4 py-3 z-10">
        <button onClick={onBack} className="flex items-center text-gray-400 hover:text-white transition-colors min-h-[44px]">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          Back
        </button>
      </div>
      <div className="max-w-2xl mx-auto p-6 pb-16 space-y-6 text-sm leading-relaxed">
        <div>
          <h1 className="text-2xl font-serif font-bold text-white">Privacy Policy</h1>
          <p className="text-xs text-gray-500 mt-1">Last updated: November 22, 2026</p>
        </div>
        <section>
          <h2 className="text-lg font-bold text-white mb-2">What this app does</h2>
          <p className="mb-2">My Church Bible Study turns a sermon into a week of Bible study. This page says what information the app handles, where it goes, and what you can do about it.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-white mb-2">What we collect</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">Account details.</strong> Your name and email address and, if you sign in with Google or Apple, the profile picture and account identifier they provide.</li>
            <li><strong className="text-white">What you give the app to make a study.</strong> Sermon audio you record or upload, photos of notes or bulletins, text you paste, and YouTube links.</li>
            <li><strong className="text-white">What the app makes for you.</strong> Your studies, which days you have finished, and events read from a bulletin.</li>
            <li><strong className="text-white">What you post.</strong> Comments, prayer requests, testimonies, your profile and the friends you add.</li>
            <li><strong className="text-white">Your settings.</strong> Your church&apos;s name and location, service times, study preferences and reminder time.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-bold text-white mb-2">Where it goes</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">Our database.</strong> Account details, studies, progress, posts and settings are stored with Supabase, our database and sign-in provider.</li>
            <li><strong className="text-white">Google, for AI processing.</strong> Audio, photos, text and transcripts are sent to Google&apos;s Gemini service to write the study or read the bulletin. Church search also goes through Google. A recording is removed from our storage as soon as its study has been written.</li>
            <li><strong className="text-white">Sign-in providers.</strong> If you choose Google or Apple sign-in, that company confirms who you are.</li>
          </ul>
          <p className="mb-2">We do not sell your information and we do not use it for advertising.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-white mb-2">Location</h2>
          <p className="mb-2">If you allow it, the app checks your location while it is open to tell whether you are at your church. That check happens on your phone. We do not keep a history of where you have been.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-white mb-2">What other people can see</h2>
          <p className="mb-2">Your name and profile picture are visible to other people using the app. A study is visible to the people you share it with. Posts and comments are visible to other members unless you or they have blocked the other. Your email address is not shown to other users.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-white mb-2">Google user data</h2>
          <p className="mb-2">If you sign in with Google, we receive your name, email address, profile picture and Google account identifier, and use them only to sign you in and set up your profile. Our use of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" className="text-purple-400 underline">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-white mb-2">Your choices</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Delete any study, event or post you created.</li>
            <li>Delete your account and everything stored with it, in Settings under Account.</li>
            <li>Turn off location, notifications, camera or microphone access in your phone&apos;s settings at any time.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-bold text-white mb-2">Children</h2>
          <p className="mb-2">The app is not intended for children under 13, and we do not knowingly collect information from them.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold text-white mb-2">Changes and contact</h2>
          <p className="mb-2">If this policy changes, the date at the top changes with it. Questions go to the support address listed at mychurchbiblestudy.com/support.</p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicyView;
