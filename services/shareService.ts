import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { isNative } from './platform';

/** Opens the phone's share sheet. Falls back to copying to the clipboard. Returns what happened. */
export async function shareLink(data: { title: string; text: string; url: string }): Promise<'shared' | 'copied' | 'cancelled'> {
  try {
    if (isNative) { await Share.share({ ...data, dialogTitle: data.title }); return 'shared'; }
    if (navigator.share) { await navigator.share(data); return 'shared'; }
  } catch (e: any) {
    if (e?.name === 'AbortError' || /cancel/i.test(e?.message || '')) return 'cancelled';
  }
  await navigator.clipboard.writeText(`${data.text}\n${data.url}`);
  return 'copied';
}

/** Hands a calendar file to the phone (share sheet, pick Calendar) or downloads it in a browser. */
export async function openCalendarFile(fileName: string, icsContent: string): Promise<void> {
  const safeName = `${fileName.replace(/[^a-z0-9]/gi, '_').slice(0, 60) || 'event'}.ics`;
  if (isNative) {
    const { uri } = await Filesystem.writeFile({ path: safeName, data: icsContent, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: 'Add to calendar', files: [uri], dialogTitle: 'Add to calendar' }).catch(() => undefined);
    return;
  }
  const url = URL.createObjectURL(new Blob([icsContent], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', safeName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
