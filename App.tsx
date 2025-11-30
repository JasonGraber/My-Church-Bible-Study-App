import React, { useState, useEffect } from 'react';
import { AppView, SermonStudy, UserSettings, DEFAULT_SETTINGS, User } from './types';
import { getSettings, getUser } from './services/storageService';
import NavBar from './components/NavBar';
import RecordView from './views/RecordView';
import StudyDashboard from './views/StudyDashboard';
import SettingsView from './views/SettingsView';
import StudyDetail from './views/StudyDetail';
import AuthView from './views/AuthView';
import OnboardingView from './views/OnboardingView';
import EventsView from './views/EventsView';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.RECORD);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [selectedStudy, setSelectedStudy] = useState<SermonStudy | null>(null);
  const [user, setUser] = useState<User | null>(null);
  
  // State to trigger specific actions when navigating to RecordView
  const [initialRecordAction, setInitialRecordAction] = useState<'UPLOAD_AUDIO' | 'SCAN_NOTES' | 'PASTE_TEXT' | 'SCAN_BULLETIN' | null>(null);

  useEffect(() => {
    // Load initial settings and user
    const savedSettings = getSettings();
    setSettings(savedSettings);
    
    const savedUser = getUser();
    setUser(savedUser);

    // Initial View Logic
    if (savedUser) {
        if (!savedSettings.churchName) {
            setCurrentView(AppView.ONBOARDING);
        } else {
            setCurrentView(AppView.RECORD);
        }
    }

    // Sunday Notification Check
    const checkSundayReminder = () => {
        const now = new Date();
        const isSunday = now.getDay() === 0;
        
        if (isSunday && savedSettings.sundayReminderEnabled && savedSettings.serviceTimes?.length) {
            // Very basic simulation: If it's Sunday, we just log/notify once per session for demo
            if (Notification.permission === "granted") {
                 new Notification("It's Sunday!", { 
                     body: `Head to ${savedSettings.churchName || 'church'} soon! Service times: ${savedSettings.serviceTimes.join(', ')}` 
                 });
            }
        }
    };
    
    if (savedUser && savedSettings.churchName) {
        checkSundayReminder();
    }

  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    const savedSettings = getSettings();
    // If no church set, go to onboarding
    if (!savedSettings.churchName) {
        setCurrentView(AppView.ONBOARDING);
    } else {
        setCurrentView(AppView.RECORD);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentView(AppView.RECORD); // Reset view logic will handle auth gate
  };

  const handleStudyGenerated = (study: SermonStudy) => {
    setSelectedStudy(study);
  };

  const handleSelectStudy = (study: SermonStudy) => {
    setSelectedStudy(study);
    setCurrentView(AppView.STUDY_DETAIL);
  };
  
  const handleOnboardingComplete = (newSettings: UserSettings) => {
      setSettings(newSettings);
      setCurrentView(AppView.RECORD);
  };

  // Handlers for quick actions from other views
  const handleScanBulletin = () => {
      setInitialRecordAction('SCAN_BULLETIN');
      setCurrentView(AppView.RECORD);
  };

  const handleCreateStudy = (action: 'UPLOAD_AUDIO' | 'SCAN_NOTES' | 'PASTE_TEXT') => {
      setInitialRecordAction(action);
      setCurrentView(AppView.RECORD);
  };

  // Clear the initial action once consumed
  const handleRecordViewMount = (view: AppView) => {
      setCurrentView(view);
      if (view !== AppView.RECORD) {
          setInitialRecordAction(null);
      }
  };

  // Auth Gate
  if (!user) {
    return <AuthView onLogin={handleLogin} />;
  }

  const renderView = () => {
    switch (currentView) {
      case AppView.RECORD:
        return (
          <RecordView 
            settings={settings} 
            onStudyGenerated={handleStudyGenerated}
            setView={handleRecordViewMount}
            initialAction={initialRecordAction}
          />
        );
      case AppView.HISTORY:
        return (
            <StudyDashboard 
                onSelectStudy={handleSelectStudy} 
                onCreateStudy={handleCreateStudy}
            />
        );
      case AppView.EVENTS:
        return <EventsView onScanBulletin={handleScanBulletin} />;
      case AppView.SETTINGS:
        return <SettingsView onUpdate={setSettings} onLogout={handleLogout} />;
      case AppView.STUDY_DETAIL:
        return selectedStudy ? (
            <StudyDetail 
                study={selectedStudy} 
                onBack={() => setCurrentView(AppView.HISTORY)} 
            />
        ) : (
            <StudyDashboard onSelectStudy={handleSelectStudy} onCreateStudy={handleCreateStudy} />
        );
      case AppView.ONBOARDING:
        return <OnboardingView settings={settings} onComplete={handleOnboardingComplete} />;
      default:
        return <RecordView settings={settings} onStudyGenerated={handleStudyGenerated} setView={handleRecordViewMount} />;
    }
  };

  const shouldShowNavBar = currentView !== AppView.STUDY_DETAIL && currentView !== AppView.ONBOARDING;

  return (
    <div className="h-screen w-screen bg-gray-900 text-white overflow-hidden flex flex-col">
        {/* Main Content Area */}
        <main className="flex-1 h-full overflow-hidden relative">
            {renderView()}
        </main>
        
        {/* Navigation */}
        {shouldShowNavBar && (
             <NavBar currentView={currentView} setView={handleRecordViewMount} />
        )}
    </div>
  );
};

export default App;