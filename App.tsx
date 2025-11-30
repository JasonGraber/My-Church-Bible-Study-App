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
import CommunityView from './views/CommunityView';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.RECORD);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [selectedStudy, setSelectedStudy] = useState<SermonStudy | null>(null);
  const [user, setUser] = useState<User | null>(null);
  
  const [initialRecordAction, setInitialRecordAction] = useState<'UPLOAD_AUDIO' | 'SCAN_NOTES' | 'PASTE_TEXT' | 'SCAN_BULLETIN' | null>(null);

  useEffect(() => {
    // Load initial settings and user
    const savedUser = getUser();
    setUser(savedUser);

    if (savedUser) {
        const savedSettings = getSettings();
        setSettings(savedSettings);

        if (!savedSettings.churchName) {
            setCurrentView(AppView.ONBOARDING);
        } else {
            setCurrentView(AppView.RECORD);
        }

        const checkSundayReminder = () => {
            const now = new Date();
            const isSunday = now.getDay() === 0;
            if (isSunday && savedSettings.sundayReminderEnabled && savedSettings.serviceTimes?.length) {
                if (Notification.permission === "granted") {
                     new Notification("It's Sunday!", { 
                         body: `Head to ${savedSettings.churchName || 'church'} soon! Service times: ${savedSettings.serviceTimes.join(', ')}` 
                     });
                }
            }
        };
        if (savedSettings.churchName) checkSundayReminder();
    }
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    const savedSettings = getSettings();
    setSettings(savedSettings);

    if (!savedSettings.churchName) {
        setCurrentView(AppView.ONBOARDING);
    } else {
        setCurrentView(AppView.RECORD);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentView(AppView.RECORD); 
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

  const handleScanBulletin = () => {
      setInitialRecordAction('SCAN_BULLETIN');
      setCurrentView(AppView.RECORD);
  };

  const handleCreateStudy = (action: 'UPLOAD_AUDIO' | 'SCAN_NOTES' | 'PASTE_TEXT') => {
      setInitialRecordAction(action);
      setCurrentView(AppView.RECORD);
  };

  const handleRecordViewMount = (view: AppView) => {
      setCurrentView(view);
      if (view !== AppView.RECORD) {
          setInitialRecordAction(null);
      }
  };

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
      case AppView.COMMUNITY:
        return <CommunityView />;
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
        <main className="flex-1 h-full overflow-hidden relative">
            {renderView()}
        </main>
        {shouldShowNavBar && (
             <NavBar currentView={currentView} setView={handleRecordViewMount} />
        )}
    </div>
  );
};

export default App;