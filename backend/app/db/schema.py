"""
Idempotent database schema initializer for activity tracking + favorites.

supabase-py talks to Postgres through PostgREST, which cannot run DDL
(CREATE TABLE etc.), so this connects directly to the Postgres instance
behind the Supabase project using a connection string.

Setup (one-time):
  1. In the Supabase dashboard: Project Settings -> Database -> Connection string (URI).
  2. Copy it into backend/.env as DATABASE_URL=postgresql://...
  3. Restart the backend — init_schema() runs automatically on startup and is
     safe to run every time (CREATE TABLE IF NOT EXISTS).
"""
import os

import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "")

_DDL = """
CREATE TABLE IF NOT EXISTS activity_events (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL,
    event_type  TEXT NOT NULL,
    metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_events_user ON activity_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_user_type ON activity_events (user_id, event_type);

CREATE TABLE IF NOT EXISTS favorites (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL,
    word        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, word)
);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reviews (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL,
    name        TEXT NOT NULL,
    role        TEXT,
    rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    text        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews (user_id, created_at DESC);

-- Migration: users may now submit more than one review (table previously had UNIQUE(user_id))
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_user_id_key;

ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_events_owner ON activity_events;
CREATE POLICY activity_events_owner ON activity_events
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS favorites_owner ON favorites;
CREATE POLICY favorites_owner ON favorites
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS reviews_public_read ON reviews;
CREATE POLICY reviews_public_read ON reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS reviews_owner_write ON reviews;
CREATE POLICY reviews_owner_write ON reviews
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
"""


def init_schema() -> None:
    if not DATABASE_URL:
        print(
            "[db] ⚠️  DATABASE_URL not set — skipping activity schema init. "
            "Add it to backend/.env (Supabase → Project Settings → Database → Connection string)."
        )
        return
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(_DDL)
        conn.close()
        print("[db] ✅ Activity schema ready (activity_events, favorites, reviews)")
    except Exception as e:
        print(f"[db] ⚠️  Activity schema init failed: {e}")
