import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mychurchbiblestudy.app',
  appName: 'My Church Bible Study',
  webDir: 'dist',
  backgroundColor: '#111827',
  // CAP_DEV=1 npx cap sync: lets an emulator build talk to a server on this computer over plain http.
  ...(process.env.CAP_DEV ? { server: { androidScheme: 'http', cleartext: true } } : {}),
  plugins: {
    SplashScreen: { launchAutoHide: true, launchShowDuration: 600, backgroundColor: '#111827', showSpinner: false },
    LocalNotifications: { iconColor: '#9333EA' },
    SystemBars: { style: 'DARK' },
  },
};

export default config;
