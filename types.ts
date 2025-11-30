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
  name?: string;
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
  sermonTitle: string; // Generated or User Input
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
  title: string; // e.g. "Bulletin - Oct 24"
  events: ChurchEvent[];
  rawSummary: string;
}

export enum AppView {
  RECORD = 'RECORD',
  HISTORY = 'HISTORY',
  SETTINGS = 'SETTINGS',
  STUDY_DETAIL = 'STUDY_DETAIL',
  ONBOARDING = 'ONBOARDING',
  EVENTS = 'EVENTS'
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