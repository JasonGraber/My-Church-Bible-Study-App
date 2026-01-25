-- My Church Bible Study App - Row Level Security Policies
-- Run this AFTER 001_tables.sql

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
