import React from 'react';

interface PrivacyPolicyViewProps {
  onBack: () => void;
}

const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = ({ onBack }) => {
  return (
    <div className="h-full bg-gray-900 overflow-y-auto pb-safe">
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
        <h1 className="ml-4 text-lg font-bold text-white">Privacy Policy</h1>
      </div>

      <div className="p-6 max-w-2xl mx-auto text-gray-300 space-y-6">
        <div className="space-y-2">
          <p className="text-sm text-gray-500">Last Updated: October 26, 2023</p>
          <p>
            Welcome to My Church Bible Study. We respect your privacy and are committed to protecting the personal information you share with us. This Privacy Policy explains how we collect, use, and safeguard your data.
          </p>
        </div>

        <section className="space-y-2">
          <h2 className="text-xl font-bold text-white">1. Data Collection and Storage</h2>
          <p>
            <strong>Local Storage:</strong> This application primarily operates using local storage on your device. Your sermon recordings, generated study plans, and personal settings are stored locally on your phone or computer.
          </p>
          <p>
            <strong>Account Information:</strong> If you create an account, your basic profile information (name, email) is stored to personalize your experience. In this demo version, this data resides in your browser's local storage.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold text-white">2. AI and Third-Party Processing</h2>
          <p>
            To generate Bible studies and extract information from bulletins, we utilize Google's Gemini API. When you use these features:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Audio recordings, text transcripts, and images you upload are sent to Google's servers for processing.</li>
            <li>This data is used solely to generate the content you requested (e.g., a study plan).</li>
            <li>We do not retain this data on our own servers after processing is complete.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold text-white">3. Geolocation Data</h2>
          <p>
            We use your device's geolocation services to provide location-based features, such as identifying when you are at your church to prompt recording.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Your precise location data is processed locally on your device.</li>
            <li>We do not track, store, or share your location history.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold text-white">4. User Rights</h2>
          <p>
            Since your data is stored locally, you have full control over it. You can delete specific studies, events, or your entire account profile directly within the app settings, which will remove the data from your device.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold text-white">5. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us through your church administrator or support channels.
          </p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicyView;