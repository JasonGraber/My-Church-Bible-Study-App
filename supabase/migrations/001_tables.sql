-- My Church Bible Study App - Database Tables
-- Run this FIRST to create all tables

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
-- Drop and recreate to ensure correct schema
drop table if exists public.study_day_comments cascade;
drop table if exists public.study_day_progress cascade;
drop table if exists public.study_participants cascade;

create table public.study_participants (
  id uuid primary key default gen_random_uuid(),
  study_id uuid references public.studies on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  user_name text,
  user_avatar text,
  joined_at timestamp with time zone default now(),
  unique(study_id, user_id)
);

-- 8. STUDY DAY PROGRESS (individual progress per user per day)
create table public.study_day_progress (
  id uuid primary key default gen_random_uuid(),
  study_id uuid references public.studies on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  day_number integer not null,
  completed_at timestamp with time zone default now(),
  unique(study_id, user_id, day_number)
);

-- 9. STUDY DAY COMMENTS (comments on each day)
create table public.study_day_comments (
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
