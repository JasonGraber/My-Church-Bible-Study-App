-- 004: lock down access, fix schema drift, add what the app stores require.
-- Written against the live database as it stood on 2026-11-22. Safe to re-run.

-- ---------------------------------------------------------------- schema drift
alter table public.user_settings add column if not exists notifications_enabled boolean default false;
alter table public.bulletins add column if not exists user_id uuid references public.profiles(id) on delete cascade;
delete from public.bulletins where user_id is null;
alter table public.bulletins alter column user_id set not null;

-- Email lives in auth.users. Keeping a copy on the world-readable profile leaked it.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, avatar)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;
alter table public.profiles drop column if exists email;

-- liked_by_users is text[] in the live database (uuid[] in the old migration file).
alter table public.posts alter column liked_by_users type text[] using liked_by_users::text[];

-- ---------------------------------------------------------------- new tables
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment', 'day_comment', 'user', 'study')),
  target_id uuid not null,
  target_user_id uuid,
  reason text not null check (length(reason) between 1 and 2000),
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('study', 'bulletin', 'church_search', 'transcript')),
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_time on public.ai_usage (user_id, created_at desc);

-- ---------------------------------------------------------------- helpers
create or replace function public.is_study_member(p_study uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from studies s where s.id = p_study and s.user_id = auth.uid())
      or exists (select 1 from study_participants p where p.study_id = p_study and p.user_id = auth.uid());
$$;

create or replace function public.is_blocked_between(p_other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p_other)
       or (b.blocker_id = p_other and b.blocked_id = auth.uid())
  );
$$;

-- A study id is the invitation: whoever was sent the link can open and join it.
create or replace function public.get_shared_study(p_study uuid)
returns setof public.studies language sql stable security definer set search_path = public as $$
  select * from studies where id = p_study and coalesce(is_archived, false) = false and auth.uid() is not null;
$$;

create or replace function public.toggle_friend(p_target uuid)
returns text[] language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); mine text[]; removing boolean;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if p_target = me then raise exception 'You cannot add yourself'; end if;
  if not exists (select 1 from profiles where id = p_target) then raise exception 'Person not found'; end if;
  select coalesce(friends, '{}') into mine from profiles where id = me;
  removing := p_target::text = any(mine);
  if removing then
    update profiles set friends = array_remove(coalesce(friends, '{}'), p_target::text) where id = me;
    update profiles set friends = array_remove(coalesce(friends, '{}'), me::text) where id = p_target;
  else
    if is_blocked_between(p_target) then raise exception 'Person not found'; end if;
    update profiles set friends = array_append(coalesce(friends, '{}'), p_target::text) where id = me;
    update profiles set friends = array_append(array_remove(coalesce(friends, '{}'), me::text), me::text) where id = p_target;
  end if;
  select coalesce(friends, '{}') into mine from profiles where id = me;
  return mine;
end;
$$;

create or replace function public.toggle_like(p_post uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n integer;
begin
  if me is null then raise exception 'Not signed in'; end if;
  update posts
     set liked_by_users = case when me::text = any(coalesce(liked_by_users, '{}'))
                               then array_remove(liked_by_users, me::text)
                               else array_append(coalesce(liked_by_users, '{}'), me::text) end
   where id = p_post;
  update posts set likes = coalesce(array_length(liked_by_users, 1), 0) where id = p_post returning likes into n;
  return coalesce(n, 0);
end;
$$;

create or replace function public.block_user(p_target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Not signed in'; end if;
  insert into user_blocks (blocker_id, blocked_id) values (me, p_target) on conflict do nothing;
  update profiles set friends = array_remove(coalesce(friends, '{}'), p_target::text) where id = me;
  update profiles set friends = array_remove(coalesce(friends, '{}'), me::text) where id = p_target;
end;
$$;

-- Removes the signed-in user. Profiles, studies, posts, comments, settings and
-- progress all cascade from auth.users. The app deletes stored audio first.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Not signed in'; end if;
  update profiles set friends = array_remove(friends, me::text) where me::text = any(friends);
  update posts set liked_by_users = array_remove(liked_by_users, me::text),
                   likes = coalesce(array_length(array_remove(liked_by_users, me::text), 1), 0)
   where me::text = any(liked_by_users);
  delete from auth.users where id = me;
end;
$$;

-- ---------------------------------------------------------------- policies
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.studies enable row level security;
alter table public.bulletins enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.study_participants enable row level security;
alter table public.study_day_progress enable row level security;
alter table public.study_day_comments enable row level security;
alter table public.user_blocks enable row level security;
alter table public.content_reports enable row level security;
alter table public.ai_usage enable row level security;

create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy user_settings_own on public.user_settings for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy studies_select on public.studies for select to authenticated using (user_id = (select auth.uid()) or public.is_study_member(id));
create policy studies_insert on public.studies for insert to authenticated with check (user_id = (select auth.uid()));
create policy studies_update on public.studies for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy studies_delete on public.studies for delete to authenticated using (user_id = (select auth.uid()));

create policy bulletins_own on public.bulletins for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy posts_select on public.posts for select to authenticated using (not public.is_blocked_between(user_id));
create policy posts_insert on public.posts for insert to authenticated with check (user_id = (select auth.uid()));
create policy posts_delete on public.posts for delete to authenticated using (user_id = (select auth.uid()));

create policy comments_select on public.comments for select to authenticated using (not public.is_blocked_between(user_id));
create policy comments_insert on public.comments for insert to authenticated with check (user_id = (select auth.uid()));
create policy comments_delete on public.comments for delete to authenticated using (user_id = (select auth.uid()));

create policy participants_select on public.study_participants for select to authenticated using (user_id = (select auth.uid()) or public.is_study_member(study_id));
create policy participants_insert on public.study_participants for insert to authenticated with check (user_id = (select auth.uid()));
create policy participants_delete on public.study_participants for delete to authenticated using (user_id = (select auth.uid()));

create policy progress_select on public.study_day_progress for select to authenticated using (public.is_study_member(study_id));
create policy progress_insert on public.study_day_progress for insert to authenticated with check (user_id = (select auth.uid()) and public.is_study_member(study_id));
create policy progress_delete on public.study_day_progress for delete to authenticated using (user_id = (select auth.uid()));

create policy day_comments_select on public.study_day_comments for select to authenticated using (public.is_study_member(study_id) and not public.is_blocked_between(user_id));
create policy day_comments_insert on public.study_day_comments for insert to authenticated with check (user_id = (select auth.uid()) and public.is_study_member(study_id));
create policy day_comments_delete on public.study_day_comments for delete to authenticated using (user_id = (select auth.uid()));

create policy blocks_own on public.user_blocks for all to authenticated using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));
create policy reports_insert on public.content_reports for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy usage_select on public.ai_usage for select to authenticated using (user_id = (select auth.uid()));
create policy usage_insert on public.ai_usage for insert to authenticated with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- privileges
-- Signed-out visitors get nothing except adding themselves to the waitlist.
revoke all on all tables in schema public from anon;
grant insert on public.waitlist to anon, authenticated;

-- Friends and likes change only through the functions above.
revoke update on public.profiles from authenticated;
grant update (name, avatar, bio) on public.profiles to authenticated;
revoke update on public.posts from authenticated;
revoke update, delete on public.ai_usage from authenticated;
revoke select, update, delete on public.content_reports from authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.is_study_member(uuid), public.is_blocked_between(uuid), public.get_shared_study(uuid),
  public.toggle_friend(uuid), public.toggle_like(uuid), public.block_user(uuid), public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------- sermon audio
-- Private bucket. A recording sits here only between upload and study creation.
insert into storage.buckets (id, name, public, file_size_limit)
values ('sermon-audio', 'sermon-audio', false, 157286400)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists sermon_audio_insert on storage.objects;
drop policy if exists sermon_audio_select on storage.objects;
drop policy if exists sermon_audio_delete on storage.objects;
create policy sermon_audio_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'sermon-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy sermon_audio_select on storage.objects for select to authenticated
  using (bucket_id = 'sermon-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy sermon_audio_delete on storage.objects for delete to authenticated
  using (bucket_id = 'sermon-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
