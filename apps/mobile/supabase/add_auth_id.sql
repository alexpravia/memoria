-- Link app tables to Supabase auth users
alter table users add column auth_id uuid unique;
alter table co_users add column auth_id uuid unique not null;
