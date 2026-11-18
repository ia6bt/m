-- Run this whole file once in Supabase > SQL Editor.
-- 1) Admin allow-list: only users listed here can write anything.
create table if not exists public.admins (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.admins enable row level security;  -- no policies: not readable through the API

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;
grant execute on function public.is_admin() to anon, authenticated;

-- 2) Tables
create table if not exists public.profile (
  id int primary key default 1 check (id = 1),
  full_name text, title text, avatar_url text, bio text, location text,
  email text, phone text,
  github_url text, linkedin_url text, facebook_url text, instagram_url text,
  skills text[] default '{}', languages text[] default '{}', interests text[] default '{}'
);
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  site_title text, meta_description text, footer_text text,
  show_projects boolean default true, show_certificates boolean default true, show_experience boolean default true
);
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null, description text, category text,
  cover_url text, images text[] default '{}', technologies text[] default '{}',
  github_url text check (github_url is null or github_url ~* '^https?://'),
  demo_url text check (demo_url is null or demo_url ~* '^https?://'),
  published_on date, published boolean not null default true,
  sort_order int not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  title text not null, institution text, field_of_study text, year int check (year between 1950 and 2100),
  description text, image_url text, published boolean not null default true,
  sort_order int not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.experiences (
  id uuid primary key default gen_random_uuid(),
  company text not null, position text not null, location text,
  start_date date, end_date date, is_current boolean not null default false,
  description text, responsibilities text[] default '{}', attachments text[] default '{}',
  published boolean not null default true,
  sort_order int not null default 0, created_at timestamptz not null default now()
);

-- 3) Row Level Security: visitors read published rows only; admins do everything.
do $$ declare t text; begin
  foreach t in array array['projects','certificates','experiences'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "read published" on public.%I for select using (published or public.is_admin())', t);
    execute format('create policy "admin write" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
  foreach t in array array['profile','settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "read all" on public.%I for select using (true)', t);
    execute format('create policy "admin write" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- 4) Image storage: public bucket (anyone can view files), only admins can upload/replace/delete/list.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio', 'portfolio', true, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = true, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'];

create policy "admin list"   on storage.objects for select to authenticated using (bucket_id = 'portfolio' and public.is_admin());
create policy "admin insert" on storage.objects for insert to authenticated with check (bucket_id = 'portfolio' and public.is_admin());
create policy "admin update" on storage.objects for update to authenticated using (bucket_id = 'portfolio' and public.is_admin());
create policy "admin delete" on storage.objects for delete to authenticated using (bucket_id = 'portfolio' and public.is_admin());

-- 5) Initial content (only what you provided; everything is editable in the dashboard)
insert into public.profile (id, full_name, title, bio, skills, interests) values (
  1, 'Mohamed Bouchlouch', 'Web & Software Development · Quality · Industry',
  'Industrial production and quality professional with experience at CITIC Dicastal in Kénitra, trained in software development and quality, hygiene, safety and environment.',
  array['Python','Java','HTML','Computer skills'],
  array['Web Development','Software Development','Programming','Quality','Industrial Experience']
) on conflict (id) do nothing;
insert into public.settings (id, site_title, footer_text) values (1, 'Mohamed Bouchlouch — Portfolio', 'Mohamed Bouchlouch') on conflict (id) do nothing;
insert into public.certificates (title, field_of_study, year, sort_order) values
  ('Technicien Spécialisé en Qualité, Hygiène, Sécurité et Environnement', 'Quality, Hygiene, Safety and Environment', null, 0),
  ('Technicien Spécialisé en Développement Informatique', 'Software development', null, 1),
  ('Diplôme de couture', 'Sewing', 2019, 2);
insert into public.experiences (company, position, location, description, sort_order) values
  ('CITIC Dicastal', 'Machining / Production', 'Kénitra', 'Quality and industrial production experience in a machining environment.', 0);
