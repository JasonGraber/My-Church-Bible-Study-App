import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'

/** Custom URL scheme the native apps use to come back from sign-in in the browser. */
export const APP_SCHEME = 'com.mychurchbiblestudy.app';
export const AUTH_CALLBACK_URL = `${APP_SCHEME}://auth-callback`;

/** Public website. Share links point here. */
export const SITE_URL = 'https://mychurchbiblestudy.com';

/**
 * Where the API lives. The website talks to the server it was loaded from.
 * The native apps are loaded from the phone, so they need the full address.
 */
export const API_BASE: string = (process.env.API_BASE_URL || (isNative ? SITE_URL : '')).replace(/\/$/, '');

export const shareLinkForStudy = (studyId: string) => `${SITE_URL}/?study=${encodeURIComponent(studyId)}`;
