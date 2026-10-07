/**
 * reviewsApi.ts
 * Client for the SignTalk FastAPI backend's /reviews endpoints.
 * Backs the Home page testimonials with real, user-submitted reviews.
 */
import { supabase } from './supabase';

const BASE_URL = (import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000') + '/reviews';

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function parseError(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({}));
  throw new Error((body as { detail?: string }).detail ?? `HTTP ${res.status}`);
}

export interface PublicReview {
  name: string;
  role: string | null;
  rating: number;
  text: string;
  created_at: string;
}

export interface MyReview {
  id: number;
  rating: number;
  text: string;
  role: string | null;
  created_at: string;
}

export async function getPublicReviews(limit = 6): Promise<PublicReview[]> {
  const res = await fetch(`${BASE_URL}/public?limit=${limit}`);
  if (!res.ok) return parseError(res);
  const data = (await res.json()) as { reviews: PublicReview[] };
  return data.reviews;
}

export async function getMyReviews(): Promise<MyReview[]> {
  const res = await fetch(`${BASE_URL}/mine`, { headers: await authHeaders() });
  if (!res.ok) return parseError(res);
  const data = (await res.json()) as { reviews: MyReview[] };
  return data.reviews;
}

export async function addReview(review: { rating: number; text: string; role?: string }): Promise<void> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(review),
  });
  if (!res.ok) return parseError(res);
}

export async function updateReview(id: number, review: { rating: number; text: string; role?: string }): Promise<void> {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify(review),
  });
  if (!res.ok) return parseError(res);
}

export async function deleteReview(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/${id}`, { method: 'DELETE', headers: await authHeaders() });
  if (!res.ok) return parseError(res);
}
