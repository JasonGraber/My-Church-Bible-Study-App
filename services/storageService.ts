import { UserSettings, SermonStudy, DEFAULT_SETTINGS, User, Bulletin } from '../types';

const SETTINGS_KEY = 'sermon_scribe_settings';
const STUDIES_KEY = 'sermon_scribe_studies';
const USER_KEY = 'sermon_scribe_user';
const BULLETINS_KEY = 'sermon_scribe_bulletins';

// --- User Management ---
export const getUser = (): User | null => {
  try {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
};

export const saveUser = (user: User): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const logoutUser = (): void => {
  localStorage.removeItem(USER_KEY);
};

// --- Settings ---
export const getSettings = (): UserSettings => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    
    const parsed = JSON.parse(stored);
    // Merge with defaults to ensure new fields (like studyLength) exist for old users
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (settings: UserSettings): void => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

// --- Studies ---
export const getStudies = (): SermonStudy[] => {
  try {
    const stored = localStorage.getItem(STUDIES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

export const saveStudy = (study: SermonStudy): void => {
  const studies = getStudies();
  // Check if exists, update if so, else unshift
  const index = studies.findIndex(s => s.id === study.id);
  if (index >= 0) {
    studies[index] = study;
  } else {
    studies.unshift(study);
  }
  localStorage.setItem(STUDIES_KEY, JSON.stringify(studies));
};

export const deleteStudy = (id: string): void => {
  const studies = getStudies().filter(s => s.id !== id);
  localStorage.setItem(STUDIES_KEY, JSON.stringify(studies));
};

export const getStudyById = (id: string): SermonStudy | undefined => {
  return getStudies().find(s => s.id === id);
};

// --- Bulletins ---
export const getBulletins = (): Bulletin[] => {
  try {
    const stored = localStorage.getItem(BULLETINS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

export const saveBulletin = (bulletin: Bulletin): void => {
  const items = getBulletins();
  
  // Deduplication Logic
  // 1. Gather all existing events from storage
  const allExistingEvents = items.flatMap(b => b.events);

  // 2. Filter the events in the NEW bulletin
  // We keep an event only if it DOES NOT match an existing event (Title + Date)
  const uniqueEvents = bulletin.events.filter(newEvent => {
      const isDuplicate = allExistingEvents.some(existing => {
          const titleA = (existing.title || "").toLowerCase().trim();
          const titleB = (newEvent.title || "").toLowerCase().trim();
          const dateA = existing.date;
          const dateB = newEvent.date;
          // You could also check 'time' or 'location' if strictness is needed,
          // but Title + Date is usually sufficient for church events.
          return titleA === titleB && dateA === dateB;
      });
      return !isDuplicate;
  });

  // 3. Create a version of the bulletin with only unique events
  const dedupedBulletin = {
      ...bulletin,
      events: uniqueEvents
  };

  items.unshift(dedupedBulletin);
  localStorage.setItem(BULLETINS_KEY, JSON.stringify(items));
};

export const deleteBulletin = (id: string): void => {
  const items = getBulletins().filter(b => b.id !== id);
  localStorage.setItem(BULLETINS_KEY, JSON.stringify(items));
};

export const deleteEvent = (eventId: string): void => {
  const bulletins = getBulletins();
  
  // Iterate through all bulletins and filter out the event
  const updatedBulletins = bulletins.map(bulletin => ({
    ...bulletin,
    events: bulletin.events.filter(e => e.id !== eventId)
  }));

  localStorage.setItem(BULLETINS_KEY, JSON.stringify(updatedBulletins));
};