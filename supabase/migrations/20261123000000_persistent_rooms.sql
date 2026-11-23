-- Persistent party rooms: members and swipes survive app restarts so people
-- can swipe on their own schedule (remote / async) and still match.
--
-- There's no auth in the app, so the tables are locked down completely and
-- the client only talks to them through the SECURITY DEFINER functions below.
-- Every function requires the room code, so nobody can list other rooms.
-- Member ids are per-install random strings — good enough for an MVP, not a
-- security boundary.

create table if not exists public.rooms (
  code        text primary key check (code ~ '^[A-Z0-9]{4,8}$'),
  host_id     text not null,
  genres      int[] not null default '{}',
  mode        text not null default 'all' check (mode in ('all', 'cinema', 'streaming')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.room_members (
  room_code  text not null references public.rooms (code) on delete cascade,
  member_id  text not null check (length(member_id) between 1 and 64),
  name       text not null check (length(name) between 1 and 32),
  joined_at  timestamptz not null default now(),
  primary key (room_code, member_id)
);

create table if not exists public.room_swipes (
  room_code  text not null,
  member_id  text not null,
  movie_id   int  not null,
  direction  text not null check (direction in ('left', 'right', 'up', 'down')),
  movie      jsonb not null,
  swiped_at  timestamptz not null default now(),
  primary key (room_code, member_id, movie_id),
  foreign key (room_code, member_id)
    references public.room_members (room_code, member_id) on delete cascade
);

alter table public.rooms        enable row level security;
alter table public.room_members enable row level security;
alter table public.room_swipes  enable row level security;
-- No policies on purpose: anon/authenticated get no direct table access.
revoke all on public.rooms, public.room_members, public.room_swipes from anon, authenticated;

-- Full snapshot of one room.
create or replace function public.room_get(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when r.code is null then null else jsonb_build_object(
    'code',     r.code,
    'host_id',  r.host_id,
    'genres',   to_jsonb(r.genres),
    'mode',     r.mode,
    'members',  coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.member_id, 'name', m.name,
               'joined_at', (extract(epoch from m.joined_at) * 1000)::bigint)
             order by m.joined_at)
      from room_members m where m.room_code = r.code), '[]'::jsonb),
    'swipes',   coalesce((
      select jsonb_agg(jsonb_build_object(
               'member_id', s.member_id, 'movie_id', s.movie_id,
               'direction', s.direction,
               -- only queued films need the full payload (for match / common ground UI)
               'movie', case when s.direction = 'right' then s.movie else null end))
      from room_swipes s where s.room_code = r.code), '[]'::jsonb)
  ) end
  from (select 1) _ left join rooms r on r.code = upper(p_code);
$$;

-- Create a new room with the caller as host. Fails if the code is taken.
create or replace function public.room_create(
  p_code text, p_member_id text, p_name text, p_genres int[], p_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into rooms (code, host_id, genres, mode)
  values (upper(p_code), p_member_id, coalesce(p_genres, '{}'), coalesce(p_mode, 'all'));
  insert into room_members (room_code, member_id, name)
  values (upper(p_code), p_member_id, left(p_name, 32));
  return room_get(p_code);
end;
$$;

-- Join (or rejoin) an existing room. Returns null if the room doesn't exist.
create or replace function public.room_join(p_code text, p_member_id text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from rooms where code = upper(p_code)) then
    return null;
  end if;
  insert into room_members (room_code, member_id, name)
  values (upper(p_code), p_member_id, left(p_name, 32))
  on conflict (room_code, member_id) do update set name = excluded.name;
  return room_get(p_code);
end;
$$;

-- Record (or change) a member's swipe on a film.
create or replace function public.room_swipe(
  p_code text, p_member_id text, p_movie_id int, p_direction text, p_movie jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_column_size(p_movie) > 16384 then
    raise exception 'movie payload too large';
  end if;
  insert into room_swipes (room_code, member_id, movie_id, direction, movie)
  select upper(p_code), p_member_id, p_movie_id, p_direction, p_movie
  where exists (
    select 1 from room_members where room_code = upper(p_code) and member_id = p_member_id
  )
  on conflict (room_code, member_id, movie_id)
  do update set direction = excluded.direction, movie = excluded.movie, swiped_at = now();
end;
$$;

-- Host-only: change the room's deck filter.
create or replace function public.room_update(
  p_code text, p_member_id text, p_genres int[], p_mode text
)
returns void
language sql
security definer
set search_path = public
as $$
  update rooms
     set genres = coalesce(p_genres, genres), mode = coalesce(p_mode, mode), updated_at = now()
   where code = upper(p_code) and host_id = p_member_id;
$$;

-- Leave a room (drops your swipes). Hands host to the next member; deletes
-- the room once it's empty.
create or replace function public.room_leave(p_code text, p_member_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_host text;
begin
  delete from room_members where room_code = upper(p_code) and member_id = p_member_id;
  select member_id into next_host from room_members
   where room_code = upper(p_code) order by joined_at limit 1;
  if next_host is null then
    delete from rooms where code = upper(p_code);
  else
    update rooms set host_id = next_host
     where code = upper(p_code) and host_id = p_member_id;
  end if;
end;
$$;

revoke all on function
  public.room_get(text),
  public.room_create(text, text, text, int[], text),
  public.room_join(text, text, text),
  public.room_swipe(text, text, int, text, jsonb),
  public.room_update(text, text, int[], text),
  public.room_leave(text, text)
from public;

grant execute on function
  public.room_get(text),
  public.room_create(text, text, text, int[], text),
  public.room_join(text, text, text),
  public.room_swipe(text, text, int, text, jsonb),
  public.room_update(text, text, int[], text),
  public.room_leave(text, text)
to anon, authenticated;
