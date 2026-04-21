import client from './client';
import i18n from '../i18n';

interface RawAnnouncement {
  id: string;
  title: string;
  content: string | null;
  image_url: string | null;
  link_url: string | null;
  link_label: string | null;
  announcement_type: string;
  priority: number;
  sponsor_store_id: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string | null;
  image_url: string | null;
  link_url: string | null;
  link_label: string | null;
  announcement_type: string;
  priority: number;
  sponsor_store_id: string | null;
  created_at: string;
}

/** Parse a field that may be a JSON object with language keys or a plain string */
function localizeField(value: string | null, fallback: string = ''): string {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'object' && parsed !== null) {
      const lang = i18n.language;
      return parsed[lang] || parsed.tr || parsed.en || fallback;
    }
    return value;
  } catch {
    return value;
  }
}

export async function getAnnouncements(): Promise<Announcement[]> {
  const {data} = await client.get<RawAnnouncement[]>('/announcements');
  return data.map(a => ({
    ...a,
    title: localizeField(a.title, a.title),
    content: localizeField(a.content),
    link_label: localizeField(a.link_label),
  }));
}

export async function trackView(id: string): Promise<void> {
  await client.post(`/announcements/${id}/view`);
}

export async function trackClick(id: string): Promise<void> {
  await client.post(`/announcements/${id}/click`);
}
