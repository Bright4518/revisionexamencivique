-- ============================================================
-- EXAMEN CIVIQUE 2026 — Supabase Database Setup v2
-- Exécutez ce script dans l'éditeur SQL de Supabase
-- Si vous avez déjà exécuté v1, cliquez sur "Run" quand même
-- (les CREATE IF NOT EXISTS et OR REPLACE gèrent les doublons)
-- ============================================================

-- 1. TABLE PROFILES
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text default '',
  is_donor boolean default false not null,
  donation_date timestamptz,
  donation_amount numeric(10,2) default 0,
  paypal_transaction_id text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 2. TABLE DONATIONS
create table if not exists public.donations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  paypal_transaction_id text not null unique,
  amount numeric(10,2) not null,
  currency text default 'EUR' not null,
  status text default 'completed' not null,
  created_at timestamptz default now() not null
);

-- 3. ACTIVER ROW LEVEL SECURITY
alter table public.profiles enable row level security;
alter table public.donations enable row level security;

-- 4. SUPPRIMER LES ANCIENNES POLITIQUES (pour éviter les conflits)
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Service role can manage profiles" on public.profiles;
drop policy if exists "Users can view own donations" on public.donations;
drop policy if exists "Users can insert own donations" on public.donations;

-- 5. POLITIQUES RLS — PROFILES
-- Lire son propre profil
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Mettre à jour son propre profil
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Insérer son propre profil (appelé depuis le JS après confirmation email)
-- Le service_role bypass RLS — on autorise aussi via la clé anon si uid correspond
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- 6. POLITIQUES RLS — DONATIONS
create policy "Users can view own donations"
  on public.donations for select
  using (auth.uid() = user_id);

create policy "Users can insert own donations"
  on public.donations for insert
  with check (auth.uid() = user_id);

-- 7. TRIGGER auto-updated_at
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_profile_updated on public.profiles;
create trigger on_profile_updated
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

-- 8. TRIGGER auto-création profil à l'inscription
-- Ce trigger crée le profil AVANT que le JS essaie de le lire
-- Il utilise security definer pour bypasser RLS
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, is_donor)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    false
  )
  on conflict (id) do nothing; -- Évite les doublons si le JS crée le profil en premier
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 9. INDEX pour performance
create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists profiles_is_donor_idx on public.profiles(is_donor);
create index if not exists donations_user_id_idx on public.donations(user_id);
create index if not exists donations_transaction_idx on public.donations(paypal_transaction_id);

-- ============================================================
-- VÉRIFICATION FINALE
-- ============================================================
select 
  'profiles' as table_name,
  count(*) as rows,
  'OK' as status
from public.profiles
union all
select 
  'donations',
  count(*),
  'OK'
from public.donations;
