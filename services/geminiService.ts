// Everything here goes through our own server. The AI key never reaches the phone or the browser.
import { SermonStudy, UserSettings, Bulletin } from '../types';
import { getCurrentUser } from './authService';
import { supabase } from './supabaseClient';
import { apiFetch } from './api';

const AUDIO_BUCKET = 'sermon-audio';
const STUDY_TIMEOUT_MS = 6 * 60 * 1000;

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const toImagePayload = (images: Blob[]) =>
  Promise.all(images.map(async (img) => ({ mimeType: img.type || 'image/jpeg', data: await blobToBase64(img) })));

const EXTENSIONS: Record<string, string> = {
  'audio/aac': 'aac', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
  'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/flac': 'flac',
};

/** Puts a recording in the user's private folder and returns its path. The server removes it after use. */
async function uploadAudio(audio: Blob, mimeTypeHint?: string): Promise<string> {
  const user = getCurrentUser();
  if (!user) throw new Error('Please sign in again.');
  const mimeType = (mimeTypeHint || audio.type || 'audio/mp4').split(';')[0];
  const path = `${user.id}/${crypto.randomUUID()}.${EXTENSIONS[mimeType] || 'm4a'}`;
  const { error } = await supabase.storage.from(AUDIO_BUCKET).upload(path, audio, { contentType: mimeType, upsert: false });
  if (error) {
    throw new Error(/exceeded|too large/i.test(error.message)
      ? 'That recording is too large to upload (the limit is 150 MB).'
      : 'The recording could not be uploaded. Check your connection and try again.');
  }
  return path;
}

export const searchChurch = (query: string) =>
  apiFetch<{ name: string; address: string; lat: number; lng: number; uri?: string; serviceTimes?: string[] }[]>(
    '/api/church/search', { body: { query } });

export const processBulletin = async (images: Blob[]): Promise<Bulletin> => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const data = await apiFetch<{ title: string; rawSummary: string; events: any[] }>(
    '/api/bulletins/process', { body: { images: await toImagePayload(images), today }, timeoutMs: 120000 });
  return {
    id: crypto.randomUUID(),
    userId: getCurrentUser()?.id || 'anonymous',
    dateScanned: new Date().toISOString(),
    title: data.title,
    events: data.events.map((e) => ({ ...e, id: crypto.randomUUID() })),
    rawSummary: data.rawSummary,
  };
};

export const generateBibleStudy = async (
  input: { audioBlob?: Blob; audioMimeType?: string; audioDurationSeconds?: number; text?: string; images?: Blob[]; youtubeUrl?: string },
  settings: UserSettings,
  onStage?: (stage: 'UPLOADING' | 'WRITING') => void
): Promise<SermonStudy> => {
  let audioPath: string | undefined;
  if (input.audioBlob) {
    onStage?.('UPLOADING');
    audioPath = await uploadAudio(input.audioBlob, input.audioMimeType);
  }
  onStage?.('WRITING');
  const data = await apiFetch<{ sermonTitle: string; preacher: string; days: any[] }>('/api/studies/generate', {
    timeoutMs: STUDY_TIMEOUT_MS,
    body: {
      audioPath,
      text: input.text,
      youtubeUrl: input.youtubeUrl,
      images: input.images?.length ? await toImagePayload(input.images) : undefined,
      settings: {
        studyDuration: settings.studyDuration,
        studyLength: settings.studyLength,
        supportingReferencesCount: settings.supportingReferencesCount,
      },
    },
  });
  return {
    id: crypto.randomUUID(),
    userId: getCurrentUser()?.id || 'anonymous',
    sermonTitle: data.sermonTitle,
    preacher: data.preacher || 'Guest Speaker',
    dateRecorded: new Date().toISOString(),
    originalAudioDuration: Math.round(input.audioDurationSeconds || 0),
    isCompleted: false,
    days: data.days.map((d) => ({ ...d, isCompleted: false })),
  };
};
