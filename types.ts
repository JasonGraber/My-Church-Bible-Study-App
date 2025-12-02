
export enum StudyDuration {
  FIVE_DAY = 5,
  SEVEN_DAY = 7,
}

export enum StudyLength {
  SHORT = "5 mins",
  MEDIUM = "15 mins",
  LONG = "30 mins"
}

export interface User {
  id: string;
  email: string;
  name: string;
  password?: string; // Stored locally for demo auth
  avatar?: string;
  bio?: string;
  churchName?: string;
  googleId?: string;
  friends?: string[]; // List of User IDs
}

export interface GeoLocation {
  lat: number;
  lng: number;
  address?: string;
}

export interface UserSettings {
  studyDuration: StudyDuration;
  studyLength: StudyLength;
  supportingReferencesCount: number;
  notificationTime: string; // "08:00"
  churchLocation: GeoLocation | null;
  churchName: string;
  serviceTimes?: string[]; // e.g. ["09:00", "11:00"]
  geofenceEnabled: boolean;
  sundayReminderEnabled?: boolean;
}

export interface DailyStudy {
  day: number;
  topic: string;
  scriptureReference: string;
  supportingScriptures: string[];
  devotionalContent: string;
  reflectionQuestion: string;
  prayerFocus: string;
  isCompleted?: boolean;
}

export interface SermonStudy {
  id: string;
  userId: string; // Owner
  sermonTitle: string; 
  preacher?: string;
  dateRecorded: string;
  originalAudioDuration: number; // seconds
  days: DailyStudy[];
  isCompleted: boolean;
}

export interface ChurchEvent {
  id?: string;
  title: string;
  date: string; // ISO Date String YYYY-MM-DD
  time: string; // e.g. "7:00 PM"
  location: string;
  description: string;
}

export interface Bulletin {
  id: string;
  dateScanned: string;
  title: string; 
  events: ChurchEvent[];
  rawSummary: string;
}

// Social Types
export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  timestamp: string;
  replies?: Comment[];
}

export interface Post {
  id: string;
  userId: string; // Author
  userName: string;
  userAvatar?: string; // Color code or URL
  studyId?: string; // Linked study
  content: string; // "Just finished this study on Grace..."
  timestamp: string;
  likes: number;
  isLikedByCurrentUser: boolean;
  comments: Comment[];
  type: 'STUDY_SHARE' | 'PRAYER_REQUEST' | 'testimony';
}

export interface SocialProfile {
    id: string;
    name: string;
    avatar: string;
    isFriend: boolean;
}

export enum AppView {
  RECORD = 'RECORD',
  HISTORY = 'HISTORY',
  SETTINGS = 'SETTINGS',
  STUDY_DETAIL = 'STUDY_DETAIL',
  ONBOARDING = 'ONBOARDING',
  EVENTS = 'EVENTS',
  COMMUNITY = 'COMMUNITY',
  PROFILE = 'PROFILE',
  PRIVACY_POLICY = 'PRIVACY_POLICY',
  TERMS_OF_SERVICE = 'TERMS_OF_SERVICE'
}

export const DEFAULT_SETTINGS: UserSettings = {
  studyDuration: StudyDuration.FIVE_DAY,
  studyLength: StudyLength.MEDIUM,
  supportingReferencesCount: 2,
  notificationTime: "07:00",
  churchLocation: null,
  churchName: "",
  serviceTimes: [],
  geofenceEnabled: false,
  sundayReminderEnabled: true
};
