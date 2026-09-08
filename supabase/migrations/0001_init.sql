-- AURA Interiors — Cloud Foundation schema.
--
-- Mirrors the existing frontend domain model (src/types/index.ts,
-- src/types/canvas.ts) as closely as possible rather than inventing a
-- second schema: pricing/BOQ/quotation math stays entirely in
-- src/lib/pricing.ts and src/lib/quotation.ts — this schema only stores the
-- inputs/outputs those functions already work with (RoomItem, PricingConfig,
-- QuotationItem, etc.) as columns or JSONB, so nothing here recomputes a
-- total independently of the existing TypeScript engine.
--
-- Every business table carries a denormalized `workspace_id` (rather than
-- relying on multi-hop joins for Row Level Security) so RLS policies stay a
-- single, fast, easily-audited predicate per table.
--
-- Run this against a fresh Supabase project's SQL editor, or via the
-- Supabase CLI (`supabase db push`) — see docs/SUPABASE_SETUP.md.

-- ============================================================
-- 1. Workspaces + membership + profiles
-- ============================================================

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Studio',
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.workspace_role as enum ('owner', 'admin', 'member');

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  default_workspace_id uuid references public.workspaces (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every new auth.users row gets: a profile, a default workspace it owns, and
-- an 'owner' membership row for that workspace. Runs as SECURITY DEFINER so
-- it can write these rows during signup before any RLS policy could
-- otherwise apply — this is the ONLY place workspace/membership rows are
-- created outside of a user's own already-established membership.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
begin
  insert into public.workspaces (name, owner_id)
  values (coalesce(new.raw_user_meta_data ->> 'studio_name', 'My Studio'), new.id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  insert into public.profiles (id, full_name, default_workspace_id)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new_workspace_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- SECURITY DEFINER helper so workspace_members' own RLS policy doesn't have
-- to (recursively) query workspace_members through RLS to check membership.
-- Owned by the migration-running role (not exposed to anon/authenticated
-- directly as a bypass — it only ever returns a boolean).
create or replace function public.is_member_of(ws_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws_id and m.user_id = auth.uid()
  );
$$;

-- ============================================================
-- 2. Business data — Client -> Project -> Rooms -> Requirements -> Items
-- ============================================================

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  city text not null default '',
  status text not null default 'lead',
  avatar_color text not null default '#948676',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null,
  type text not null default 'full-home',
  status text not null default 'draft',
  address text not null default '',
  budget_estimate numeric not null default 0,
  target_date date,
  cover_color text not null default '#948676',
  -- PricingConfig { markupPercent, discountType, discountValue, taxRatePercent } —
  -- kept as JSONB (not columns) so lib/pricing.ts's PricingConfig shape can
  -- evolve without a migration; the calculation code itself stays in the app.
  pricing jsonb not null default '{"markupPercent":0,"discountType":"none","discountValue":0,"taxRatePercent":0}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  type text not null default 'living-room',
  name text not null,
  -- RoomDimensions { lengthFt, widthFt, heightFt }
  dimensions jsonb not null default '{"lengthFt":0,"widthFt":0,"heightFt":10}'::jsonb,
  notes text,
  is_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.requirements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  room_id uuid not null references public.rooms (id) on delete cascade,
  label text not null,
  is_checked boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.catalogue_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  category text not null,
  sub_category text,
  description text,
  unit text not null default 'sqft',
  default_rate numeric not null default 0,
  material text,
  finish text,
  brand text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  room_id uuid not null references public.rooms (id) on delete cascade,
  catalogue_item_id uuid references public.catalogue_items (id) on delete set null,
  name text not null,
  category text not null,
  description text,
  unit text not null default 'sqft',
  quantity numeric not null default 0,
  master_rate numeric not null default 0,
  rate numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 3. Quotations
-- ============================================================

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  quotation_number text not null,
  revision integer not null default 1,
  status text not null default 'draft',
  issue_date date not null default current_date,
  valid_until date not null,
  client_name text not null,
  project_name text not null,
  project_location text not null default '',
  -- Snapshotted at creation time, same as the existing frontend model —
  -- company profile, pricing config, payment milestones, T&Cs never mutate
  -- retroactively when the source data changes.
  company jsonb not null default '{}'::jsonb,
  pricing jsonb not null default '{"markupPercent":0,"discountType":"none","discountValue":0,"taxRatePercent":0}'::jsonb,
  payment_milestones jsonb not null default '[]'::jsonb,
  terms_and_conditions jsonb not null default '[]'::jsonb,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  room_id uuid references public.rooms (id) on delete set null,
  room_name text not null,
  source_item_id uuid,
  category text not null,
  name text not null,
  description text,
  quantity numeric not null default 0,
  unit text not null default 'sqft',
  rate numeric not null default 0,
  source_rate numeric not null default 0,
  is_included boolean not null default true,
  is_optional boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 4. AURA Canvas documents (Plan / Elevation / Perspective)
-- ============================================================

-- One row per (room, view). `view_id` mirrors CanvasDocument.viewId exactly
-- ('plan' | 'wall-1'..'wall-4' | 'perspective') — the entire CanvasDocument
-- (objects, layers, settings, elevation/perspective config, dimensions,
-- units, drawing mode) is stored as-is in `document`, the same JSON already
-- written to localStorage by lib/canvasStorage.ts. This deliberately does
-- NOT re-model Canvas geometry in SQL columns — the coordinate system and
-- every existing field stay exactly as the engine already produces them.
create table if not exists public.canvas_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  room_id uuid not null references public.rooms (id) on delete cascade,
  view_id text not null default 'plan',
  document jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, view_id)
);

-- ============================================================
-- 5. Project Media — Site Photos (Supabase Storage) + Drive References
-- ============================================================

create table if not exists public.site_photos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  room_id uuid references public.rooms (id) on delete set null,
  storage_path text not null,
  filename text not null,
  mime_type text not null default 'image/jpeg',
  file_size integer,
  caption text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Google Drive stays the source of truth — only reference metadata is ever
-- stored here. There is deliberately no column that could hold the image
-- itself; `drive_file_id` + the link fields are enough to display it and
-- open it back in Drive. Removing a row here must never call the Drive API
-- to delete the original file (enforced in application code, not SQL).
create table if not exists public.drive_references (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  room_id uuid references public.rooms (id) on delete set null,
  drive_file_id text not null,
  name text not null,
  mime_type text not null default 'image/jpeg',
  thumbnail_link text,
  preview_link text,
  web_view_link text,
  icon_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Locally-uploaded references (source: 'local' in the frontend union type)
-- reuse the same private storage bucket as Site Photos; this table only
-- carries the metadata row.
create table if not exists public.local_references (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  storage_path text not null,
  name text not null,
  mime_type text not null default 'image/jpeg',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 6. updated_at maintenance
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'workspaces', 'profiles', 'clients', 'projects', 'rooms',
    'catalogue_items', 'room_items', 'quotations', 'quotation_items',
    'canvas_documents', 'site_photos', 'drive_references', 'local_references'
  ]
  loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I; create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at();',
      t, t
    );
  end loop;
end $$;

-- ============================================================
-- 7. Row Level Security
-- ============================================================

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.rooms enable row level security;
alter table public.requirements enable row level security;
alter table public.catalogue_items enable row level security;
alter table public.room_items enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
alter table public.canvas_documents enable row level security;
alter table public.site_photos enable row level security;
alter table public.drive_references enable row level security;
alter table public.local_references enable row level security;

-- workspaces: members can see their workspace(s); only the owner can update
-- it (name, etc). No client-side insert policy — rows are only ever created
-- by handle_new_user(), which runs as SECURITY DEFINER and bypasses RLS.
create policy "members can view their workspace" on public.workspaces
  for select using (public.is_member_of(id));
create policy "owner can update their workspace" on public.workspaces
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- workspace_members: any member can see the roster of a workspace they
-- belong to; only an owner can add/remove members (invite flow is future
-- work — this just keeps the schema ready for it, per the milestone spec).
create policy "members can view their workspace roster" on public.workspace_members
  for select using (public.is_member_of(workspace_id));
create policy "owners can add members" on public.workspace_members
  for insert with check (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_members.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );
create policy "owners can remove members" on public.workspace_members
  for delete using (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_members.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

-- profiles: a user can only see/edit their own profile row.
create policy "user can view own profile" on public.profiles
  for select using (id = auth.uid());
create policy "user can update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Every remaining business table shares the exact same shape: full CRUD for
-- members of the owning workspace, nothing else. Written per-table (rather
-- than one generic policy) so each is independently auditable.
do $$
declare
  t text;
begin
  foreach t in array array[
    'clients', 'projects', 'rooms', 'requirements', 'catalogue_items',
    'room_items', 'quotations', 'quotation_items', 'canvas_documents',
    'site_photos', 'drive_references', 'local_references'
  ]
  loop
    execute format(
      'create policy "workspace members can select %1$s" on public.%1$s for select using (public.is_member_of(workspace_id));',
      t
    );
    execute format(
      'create policy "workspace members can insert %1$s" on public.%1$s for insert with check (public.is_member_of(workspace_id));',
      t
    );
    execute format(
      'create policy "workspace members can update %1$s" on public.%1$s for update using (public.is_member_of(workspace_id)) with check (public.is_member_of(workspace_id));',
      t
    );
    execute format(
      'create policy "workspace members can delete %1$s" on public.%1$s for delete using (public.is_member_of(workspace_id));',
      t
    );
  end loop;
end $$;

-- ============================================================
-- 8. Storage — private "site-photos" bucket
-- ============================================================

insert into storage.buckets (id, name, public)
values ('site-photos', 'site-photos', false)
on conflict (id) do nothing;

-- Objects are stored at "<workspace_id>/<project_id>/<filename>" — the RLS
-- policy checks the first path segment against the caller's workspaces so a
-- member of workspace A can never read/write workspace B's objects, even
-- with a guessed/leaked path. Access to individual files for *viewing* goes
-- through short-lived signed URLs (created via the authenticated client),
-- never a public URL — the bucket itself is private.
create policy "workspace members can read their site photos" on storage.objects
  for select using (
    bucket_id = 'site-photos'
    and public.is_member_of((storage.foldername(name))[1]::uuid)
  );
create policy "workspace members can upload their site photos" on storage.objects
  for insert with check (
    bucket_id = 'site-photos'
    and public.is_member_of((storage.foldername(name))[1]::uuid)
  );
create policy "workspace members can delete their site photos" on storage.objects
  for delete using (
    bucket_id = 'site-photos'
    and public.is_member_of((storage.foldername(name))[1]::uuid)
  );
