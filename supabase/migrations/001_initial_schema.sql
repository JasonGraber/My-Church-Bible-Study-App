-- My Church Bible Study App - Database Schema
-- Run this SQL in Supabase SQL Editor to set up the database

-- 1. PROFILES
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  name text,
  avatar text,
  bio text,
  friends text[] default '{}'::text[],
  created_at timestamp with time zone default now()
);
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists friends text[] default '{}'::text[];

-- 2. USER SETTINGS
create table if not exists public.user_settings (
  user_id uuid references auth.users on delete cascade not null primary key,
  church_name text,
  church_location jsonb,
  study_duration integer default 5,
  study_length text default '15 mins',
  supporting_references_count integer default 2,
  notification_time text default '07:00',
  service_times text[] default '{}'::text[],
  geofence_enabled boolean default false,
  sunday_reminder_enabled boolean default true,
  updated_at timestamp with time zone default now()
);

-- 3. STUDIES
create table if not exists public.studies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  sermon_title text,
  preacher text,
  date_recorded timestamp with time zone default now(),
  original_audio_duration integer default 0,
  days jsonb not null default '[]'::jsonb,
  is_completed boolean default false,
  is_archived boolean default false,
  created_at timestamp with time zone default now()
);
alter table public.studies add column if not exists preacher text;
alter table public.studies add column if not exists is_archived boolean default false;
alter table public.studies add column if not exists original_audio_duration integer default 0;

-- 4. BULLETINS
create table if not exists public.bulletins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text,
  date_scanned timestamp with time zone default now(),
  raw_summary text,
  events jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone default now()
);

-- 5. SOCIAL POSTS
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  user_name text,
  user_avatar text,
  content text,
  type text default 'STUDY_SHARE',
  study_id uuid,
  study_data jsonb,
  likes integer default 0,
  liked_by_users uuid[] default '{}'::uuid[],
  created_at timestamp with time zone default now()
);
alter table public.posts add column if not exists study_id uuid;
alter table public.posts add column if not exists study_data jsonb;
alter table public.posts add column if not exists type text default 'STUDY_SHARE';

-- 6. COMMENTS
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts on delete cascade,
  user_id uuid references auth.users not null,
  user_name text,
  user_avatar text,
  text text,
  created_at timestamp with time zone default now()
);

-- 7. STUDY PARTICIPANTS (for Study Together feature)
create table if not exists public.study_participants (
  id uuid primary key default gen_random_uuid(),
  study_id uuid references public.studies on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  user_name text,
  user_avatar text,
  joined_at timestamp with time zone default now(),
  unique(study_id, user_id)
);

-- 8. STUDY DAY PROGRESS (individual progress per user per day)
create table if not exists public.study_day_progress (
  id uuid primary key default gen_random_uuid(),
  study_id uuid references public.studies on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  day_number integer not null,
  completed_at timestamp with time zone default now(),
  unique(study_id, user_id, day_number)
);

-- 9. STUDY DAY COMMENTS (comments on each day)
create table if not exists public.study_day_comments (
  id uuid primary key default gen_random_uuid(),
  study_id uuid references public.studies on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  user_name text,
  user_avatar text,
  day_number integer not null,
  comment text not null,
  post_id uuid references public.posts on delete set null,
  created_at timestamp with time zone default now()
);

-- ===================
-- ROW LEVEL SECURITY
-- ===================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.studies enable row level security;
alter table public.bulletins enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.study_participants enable row level security;
alter table public.study_day_progress enable row level security;
alter table public.study_day_comments enable row level security;

-- Profiles: Anyone can view, users manage their own
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select using (true);
drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- User Settings: Only own settings
drop policy if exists "user_settings_all" on public.user_settings;
create policy "user_settings_all" on public.user_settings for all using (auth.uid() = user_id);

-- Studies: Public read, user manages own
drop policy if exists "studies_select" on public.studies;
create policy "studies_select" on public.studies for select using (true);
drop policy if exists "studies_insert" on public.studies;
create policy "studies_insert" on public.studies for insert with check (auth.uid() = user_id);
drop policy if exists "studies_update" on public.studies;
create policy "studies_update" on public.studies for update using (auth.uid() = user_id);
drop policy if exists "studies_delete" on public.studies;
create policy "studies_delete" on public.studies for delete using (auth.uid() = user_id);

-- Bulletins: User's own only
drop policy if exists "bulletins_all" on public.bulletins;
create policy "bulletins_all" on public.bulletins for all using (auth.uid() = user_id);

-- Posts: Public read, user manages own
drop policy if exists "posts_select" on public.posts;
create policy "posts_select" on public.posts for select using (true);
drop policy if exists "posts_insert" on public.posts;
create policy "posts_insert" on public.posts for insert with check (auth.uid() = user_id);
drop policy if exists "posts_update" on public.posts;
create policy "posts_update" on public.posts for update using (auth.uid() = user_id);
drop policy if exists "posts_delete" on public.posts;
create policy "posts_delete" on public.posts for delete using (auth.uid() = user_id);

-- Comments: Public read, user manages own
drop policy if exists "comments_select" on public.comments;
create policy "comments_select" on public.comments for select using (true);
drop policy if exists "comments_insert" on public.comments;
create policy "comments_insert" on public.comments for insert with check (auth.uid() = user_id);
drop policy if exists "comments_delete" on public.comments;
create policy "comments_delete" on public.comments for delete using (auth.uid() = user_id);

-- Study Participants: Anyone can see, users manage their own
drop policy if exists "study_participants_select" on public.study_participants;
create policy "study_participants_select" on public.study_participants for select using (true);
drop policy if exists "study_participants_insert" on public.study_participants;
create policy "study_participants_insert" on public.study_participants for insert with check (auth.uid() = user_id);
drop policy if exists "study_participants_delete" on public.study_participants;
create policy "study_participants_delete" on public.study_participants for delete using (auth.uid() = user_id);

-- Study Day Progress: Anyone can see, users manage their own
drop policy if exists "study_day_progress_select" on public.study_day_progress;
create policy "study_day_progress_select" on public.study_day_progress for select using (true);
drop policy if exists "study_day_progress_insert" on public.study_day_progress;
create policy "study_day_progress_insert" on public.study_day_progress for insert with check (auth.uid() = user_id);
drop policy if exists "study_day_progress_delete" on public.study_day_progress;
create policy "study_day_progress_delete" on public.study_day_progress for delete using (auth.uid() = user_id);

-- Study Day Comments: Anyone can see, users manage their own
drop policy if exists "study_day_comments_select" on public.study_day_comments;
create policy "study_day_comments_select" on public.study_day_comments for select using (true);
drop policy if exists "study_day_comments_insert" on public.study_day_comments;
create policy "study_day_comments_insert" on public.study_day_comments for insert with check (auth.uid() = user_id);
drop policy if exists "study_day_comments_delete" on public.study_day_comments;
create policy "study_day_comments_delete" on public.study_day_comments for delete using (auth.uid() = user_id);

-- Force reload schema cache (PostgREST)
NOTIFY pgrst, 'reload schema';
