/**
 * signverseApi.ts
 * Typed client for the SignVerse FastAPI backend.
 * Place at: src/lib/signverseApi.ts
 *
 * FastAPI runs on port 8000 by default.
 * All chatbot routes are under /chatbot prefix.
 */

const BASE_URL =
  (import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000") + "/chatbot";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface VideoEntry {
  id: string;
  source?: string;
  [key: string]: unknown;
}

export interface SearchResult {
  input_word: string;
  matched_word: string | null;
  match_type: "exact" | "fuzzy" | "none";
  video: VideoEntry | null;
  video_count: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total_matched: number;
}

export interface SuggestResponse {
  prefix: string;
  suggestions: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { detail?: string }).detail ?? `HTTP ${res.status}`
    );
  }
  return res.json() as Promise<T>;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export const searchSigns = (query: string, fuzzy = true) =>
  apiFetch<SearchResponse>(
    `/search?q=${encodeURIComponent(query)}&fuzzy=${fuzzy}`
  );

export const getSuggestions = (prefix: string, limit = 8) =>
  apiFetch<SuggestResponse>(
    `/suggest?q=${encodeURIComponent(prefix)}&limit=${limit}`
  );

export const getWordDetail = (word: string) =>
  apiFetch<{ word: string; videos: VideoEntry[]; best: VideoEntry }>(
    `/word/${encodeURIComponent(word)}`
  );

export const videoUrl = (id: string) => `${BASE_URL}/video/${id}`;

export const healthCheck = () =>
  apiFetch<{ status: string; unified_vocab_size: number }>("/health");