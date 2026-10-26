-- =============================================================================
-- Quietbox — Complete PostgreSQL / Supabase Migration & Row Level Security
-- File: supabase/migrations/001_initial_schema.sql
-- Purpose: Production PostgreSQL schema, indexes, constraints, storage buckets,
--          and Row Level Security (RLS) policies for Supabase deployments.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
  avatar_url TEXT DEFAULT '' CHECK (char_length(avatar_url) <= 512),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Anonymous Pages Table
CREATE TABLE IF NOT EXISTS public.anonymous_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  page_name TEXT NOT NULL CHECK (char_length(page_name) BETWEEN 1 AND 80),
  username TEXT NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_\-]{3,30}$'),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 280),
  avatar_path TEXT NOT NULL DEFAULT '' CHECK (char_length(avatar_path) <= 512),
  is_active BOOLEAN NOT NULL DEFAULT true,
  allow_submissions BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anonymous_pages_username ON public.anonymous_pages(username);
CREATE INDEX IF NOT EXISTS idx_anonymous_pages_owner_id ON public.anonymous_pages(owner_id);

-- 3. Private Inbox Messages Table (Zero base64 images; stores storage object path only)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  anonymous_page_id UUID NOT NULL REFERENCES public.anonymous_pages(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL DEFAULT '' CHECK (char_length(message_text) <= 2000),
  image_storage_path TEXT NOT NULL DEFAULT '' CHECK (
    char_length(image_storage_path) <= 256
    AND image_storage_path NOT LIKE 'data:%'
  ),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT message_content_not_empty CHECK (
    char_length(trim(message_text)) > 0 OR char_length(image_storage_path) > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_messages_recipient_created
  ON public.messages(recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON public.messages(recipient_user_id, is_read)
  WHERE is_read = false;

-- 4. Abuse Reports Table
CREATE TABLE IF NOT EXISTS public.abuse_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_page_id UUID NOT NULL REFERENCES public.anonymous_pages(id) ON DELETE CASCADE,
  target_username TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 60),
  details TEXT NOT NULL DEFAULT '' CHECK (char_length(details) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Row Level Security (RLS) Policies
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abuse_reports ENABLE ROW LEVEL SECURITY;

-- Profiles: Strictly private to the authenticated owner
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete their own profile"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- Anonymous Pages: Owner manages own page; public can view active pages via public view/select
CREATE POLICY "Owners can manage their own anonymous page"
  ON public.anonymous_pages FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Visitors can read active anonymous pages"
  ON public.anonymous_pages FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Messages: Strict recipient isolation & server-derived recipient check
CREATE POLICY "Recipients can read only their own messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (auth.uid() = recipient_user_id);

CREATE POLICY "Recipients can mark only their own messages read"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_user_id)
  WITH CHECK (auth.uid() = recipient_user_id);

CREATE POLICY "Recipients can delete only their own messages"
  ON public.messages FOR DELETE
  TO authenticated
  USING (auth.uid() = recipient_user_id);

CREATE POLICY "Anonymous visitors can submit only to active accepting pages"
  ON public.messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    is_read = false
    AND EXISTS (
      SELECT 1 FROM public.anonymous_pages p
      WHERE p.id = anonymous_page_id
        AND p.owner_id = recipient_user_id
        AND p.is_active = true
        AND p.allow_submissions = true
    )
  );

-- Abuse Reports: Write-only from public visitors; zero client SELECT/UPDATE/DELETE
CREATE POLICY "Visitors can submit abuse reports for active pages"
  ON public.abuse_reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.anonymous_pages p
      WHERE p.id = target_page_id
    )
  );

-- =============================================================================
-- Storage Buckets Configuration (Supabase Storage)
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('public-avatars', 'public-avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('private-message-attachments', 'private-message-attachments', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
