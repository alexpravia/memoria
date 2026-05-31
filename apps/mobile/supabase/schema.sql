-- Memoria Database Schema

-- Users: the memory-impaired person using the app
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text not null,
  date_of_birth date,
  location text,
  photo_url text,
  cognitive_level integer default 3 check (cognitive_level between 1 and 5),
  preferences jsonb default '{"audio_speed": 1.0, "text_size": "large", "language": "en"}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Life facts: key identity facts about the user
create table life_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  fact text not null,
  category text,
  display_order integer default 0,
  created_at timestamptz default now()
);

-- Co-users: family members or caregivers who manage the user's data
create table co_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text not null,
  user_id uuid references users(id) on delete cascade not null,
  relationship text not null,
  role text default 'family' check (role in ('family', 'caregiver', 'admin')),
  notification_preferences jsonb default '{"flags": true, "mood_alerts": true, "daily_summary": true}'::jsonb,
  created_at timestamptz default now()
);

-- People: important people in the user's life
create table people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  full_name text not null,
  relationship text not null,
  photo_url text,
  contact_info jsonb,
  key_facts text[],
  emotional_notes text,
  is_sensitive boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Media: photos and videos with AI-processed metadata
create table media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  file_url text not null,
  file_type text not null check (file_type in ('photo', 'video')),
  description text,
  location text,
  taken_at timestamptz,
  ai_tags jsonb,
  verification_status text default 'pending' check (verification_status in ('pending', 'verified', 'hidden')),
  verified_by uuid references co_users(id),
  created_at timestamptz default now()
);

-- Media-People junction: who appears in each photo/video
create table media_people (
  media_id uuid references media(id) on delete cascade,
  person_id uuid references people(id) on delete cascade,
  ai_confidence float,
  verified boolean default false,
  primary key (media_id, person_id)
);

-- Events: past, future, and recurring
create table events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  title text not null,
  description text,
  event_date timestamptz not null,
  end_date timestamptz,
  event_type text default 'one_time' check (event_type in ('one_time', 'recurring', 'routine')),
  recurrence_rule text,
  is_past boolean default false,
  people_involved uuid[],
  user_feeling text,
  created_at timestamptz default now()
);

-- Journal entries: voice recordings throughout the day
create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  audio_url text,
  transcription text,
  recorded_at timestamptz default now(),
  entry_type text default 'moment' check (entry_type in ('moment', 'recall_attempt')),
  mood text,
  created_at timestamptz default now()
);

-- Daily summaries: AI-generated end-of-day recaps
create table daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  summary_date date not null,
  ai_summary text,
  recall_summary text,
  review_status text default 'pending' check (review_status in ('pending', 'reviewed', 'edited')),
  reviewed_by uuid references co_users(id),
  created_at timestamptz default now(),
  unique (user_id, summary_date)
);

-- Pinned notes: "things I want to remember"
create table pinned_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  content text not null,
  audio_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Sensitivity filters: co-user defined boundaries for the AI
create table sensitivity_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  filter_type text not null check (filter_type in ('person', 'topic', 'time_period')),
  filter_value text not null,
  person_id uuid references people(id) on delete cascade,
  start_date date,
  end_date date,
  notes text,
  created_by uuid references co_users(id),
  created_at timestamptz default now()
);

-- Flag queue: items for co-user review
create table flag_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  flag_type text not null check (flag_type in ('media', 'person', 'event', 'journal', 'mood')),
  reference_id uuid not null,
  description text not null,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected', 'hidden')),
  reviewed_by uuid references co_users(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);
