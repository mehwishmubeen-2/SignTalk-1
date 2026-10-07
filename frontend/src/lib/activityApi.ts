/**
 * activityApi.ts
 * Client for the SignTalk FastAPI backend's /activity endpoints.
 * Backs the Dashboard page with real per-user data (signs practiced, video
 * calls, AI dictionary queries, voice-to-text sessions, favorites) instead
 * of static mock values.
 */
import { supabase } from './supabase';

// Note: path intentionally avoids words like "activity"/"track" — ad-blockers
// (uBlock, Brave Shields, etc.) silently block those URLs client-side.
const BASE_URL = (import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000') + '/progress';

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type ActivityEventType = 'sign_practiced' | 'video_call' | 'ai_query' | 'voice_to_text';

export interface DashboardStat {
  value: number;
  trend: string;
}

export interface WeeklyActivityDay {
  id: string;
  day: string;
  minutes: number;
  color: string;
}

export interface FeatureUsage {
  name: string;
  usage: number;
}

export interface RecentActivityItem {
  type: ActivityEventType | string;
  action: string;
  item: string;
  time: string;
}

export interface DashboardResponse {
  stats: {
    signs_learned: DashboardStat;
    video_calls: DashboardStat;
    ai_queries: DashboardStat;
    total_time_hours: DashboardStat;
  };
  weekly_activity: WeeklyActivityDay[];
  feature_usage: FeatureUsage[];
  recent_activity: RecentActivityItem[];
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Fire-and-forget event logging — never throws, so it can't break the UX it's instrumenting. */
export async function logActivityEvent(
  eventType: ActivityEventType,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    await apiFetch<{ ok: boolean }>('/events', {
      method: 'POST',
      body: JSON.stringify({ event_type: eventType, metadata }),
    });
  } catch (err) {
    console.warn('[activity] failed to log event:', eventType, err);
  }
}

export const getDashboard = () => apiFetch<DashboardResponse>('/dashboard');

export const listFavorites = () => apiFetch<{ favorites: string[] }>('/favorites');

export const addFavorite = (word: string) =>
  apiFetch<{ ok: boolean }>('/favorites', { method: 'POST', body: JSON.stringify({ word }) });

export const removeFavorite = (word: string) =>
  apiFetch<{ ok: boolean }>(`/favorites/${encodeURIComponent(word)}`, { method: 'DELETE' });
