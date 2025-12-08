
import React, { useState, useEffect } from 'react';
import { AppView, SermonStudy, UserSettings, DEFAULT_SETTINGS, User } from './types';
import { getSettings } from './services/storageService';
import { initializeSession } from './services/authService';
import { supabase } from './services/supabaseClient';
import NavBar from './components/NavBar';
import RecordView from './views/RecordView';
import StudyDashboard from './views/StudyDashboard';
import SettingsView from './views/SettingsView';
import StudyDetail from './views/StudyDetail';
import AuthView from './views/AuthView';
import OnboardingView from './views/OnboardingView';
import EventsView from './views/EventsView';
import CommunityView from './views/CommunityView';
import ProfileView from './views/ProfileView';
import PrivacyPolicyView from './views/PrivacyPolicyView';
import TermsOfServiceView from './views/TermsOfServiceView';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.RECORD);
  const [previousView, setPreviousView] = useState<AppView | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [selectedStudy, setSelectedStudy] = useState<SermonStudy | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [initialRecordAction, setInitialRecordAction] = useState<'UPLOAD_AUDIO' | 'SCAN_NOTES' | 'PASTE_TEXT' | 'SCAN_BULLETIN' | null>(null);

  useEffect(() => {
    // Check URL Params
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    if (viewParam === 'privacy') {
        setCurrentView(AppView.PRIVACY_POLICY);
        setAuthLoading(false);
        return; 
    }
    if (viewParam === 'terms') {
        setCurrentView(AppView.TERMS_OF_SERVICE);
        setAuthLoading(false);
        return;
    }

    const init = async () => {
        try {
            const sessionUser = await initializeSession();
            if (sessionUser) {
                handleLogin(sessionUser);
            }
        } catch (e) {
            console.error("Session init failed", e);
        } finally {
            setAuthLoading(false);
        }
    };
    init();

    // Listen for Auth Changes (e.g. returning from Google OAuth redirect)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
             setAuthLoading(true);
             const sessionUser = await initializeSession();
             if (sessionUser) {
                 handleLogin(sessionUser);
             }
             setAuthLoading(false);
        } else if (event === 'SIGNED_OUT') {
            handleLogout();
        }
    });

    return () => {
        authListener.subscription.unsubscribe();
    };

  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    
    // Check if user has settings from DB, otherwise fall back to default
    const userSettings = loggedInUser.settings || getSettings();
    setSettings({ ...DEFAULT_SETTINGS, ...userSettings });

    // Determine view
    if (userSettings && userSettings.churchName) {
         setCurrentView(AppView.RECORD);
    } else {
         setCurrentView(AppView.ONBOARDING);
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
  
  const handleViewProfile = (userId: string) => {
      setPreviousView(currentView);
      setSelectedUserId(userId);
      setCurrentView(AppView.PROFILE);
  };

  const handleProfileBack = () => {
      setCurrentView(previousView || AppView.COMMUNITY);
      setPreviousView(null);
      setSelectedUserId(null);
  };

  const handleShowLegal = (view: AppView.PRIVACY_POLICY | AppView.TERMS_OF_SERVICE) => {
      setPreviousView(currentView); 
      setCurrentView(view);
  };

  const handleLegalBack = () => {
      if (window.location.search) {
          window.history.replaceState({}, '', window.location.pathname);
      }
      if (previousView) {
          setCurrentView(previousView);
          setPreviousView(null);
      } else {
          setCurrentView(user ? AppView.SETTINGS : AppView.RECORD);
      }
  };

  if (authLoading) return <div className="flex h-screen w-screen items-center justify-center bg-gray-900 text-white">Loading...</div>;

  if (!user && currentView !== AppView.PRIVACY_POLICY && currentView !== AppView.TERMS_OF_SERVICE) {
    return <AuthView onLogin={handleLogin} onShowLegal={handleShowLegal} />;
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
        return <CommunityView onViewProfile={handleViewProfile} />;
      case AppView.PROFILE:
        return selectedUserId ? (
            <ProfileView userId={selectedUserId} onBack={handleProfileBack} />
        ) : (
            <CommunityView onViewProfile={handleViewProfile} />
        );
      case AppView.SETTINGS:
        return (
            <SettingsView 
                onUpdate={setSettings} 
                onLogout={handleLogout} 
                onShowLegal={handleShowLegal} 
                onViewProfile={handleViewProfile}
            />
        );
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
      case AppView.PRIVACY_POLICY:
        return <PrivacyPolicyView onBack={handleLegalBack} />;
      case AppView.TERMS_OF_SERVICE:
        return <TermsOfServiceView onBack={handleLegalBack} />;
      default:
        return <RecordView settings={settings} onStudyGenerated={handleStudyGenerated} setView={handleRecordViewMount} />;
    }
  };

  const shouldShowNavBar = 
    user && 
    currentView !== AppView.STUDY_DETAIL && 
    currentView !== AppView.ONBOARDING &&
    currentView !== AppView.PRIVACY_POLICY &&
    currentView !== AppView.TERMS_OF_SERVICE &&
    currentView !== AppView.PROFILE;

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
