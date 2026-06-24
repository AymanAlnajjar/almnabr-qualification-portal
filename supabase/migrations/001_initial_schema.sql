create extension if not exists pgcrypto;

create type public.submission_status as enum (
  'draft', 'submitted', 'under_review', 'qualified', 'rejected', 'archived'
);

create type public.pdf_status as enum ('pending', 'generating', 'ready', 'failed');

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  status public.submission_status not null default 'draft',
  pdf_state public.pdf_status not null default 'pending',
  form_data jsonb not null default '{}'::jsonb,
  office_name text not null,
  representative_email text not null,
  photo_count integer not null default 0 check (photo_count between 0 and 5),
  pdf_path text,
  pdf_error text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.submission_photos (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 5242880),
  sort_order integer not null check (sort_order between 0 and 4),
  uploaded boolean not null default false,
  created_at timestamptz not null default now(),
  unique (submission_id, sort_order)
);

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.submission_notes (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  note text not null check (char_length(note) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table public.submission_status_history (
  id bigint generated always as identity primary key,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  from_status public.submission_status,
  to_status public.submission_status not null,
  changed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index submissions_created_at_idx on public.submissions(created_at desc);
create index submissions_status_idx on public.submissions(status);
create index submission_photos_submission_idx on public.submission_photos(submission_id);
create index submission_notes_submission_idx on public.submission_notes(submission_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger submissions_set_updated_at
before update on public.submissions
for each row execute function public.set_updated_at();

alter table public.submissions enable row level security;
alter table public.submission_photos enable row level security;
alter table public.admin_users enable row level security;
alter table public.submission_notes enable row level security;
alter table public.submission_status_history enable row level security;

create policy "Admins can read their membership"
on public.admin_users for select to authenticated
using (user_id = auth.uid());

create policy "Admins can read submissions"
on public.submissions for select to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

create policy "Admins can update submissions"
on public.submissions for update to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

create policy "Admins can read photos"
on public.submission_photos for select to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

create policy "Admins can manage notes"
on public.submission_notes for all to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (
  author_id = auth.uid()
  and exists (select 1 from public.admin_users a where a.user_id = auth.uid())
);

create policy "Admins can read status history"
on public.submission_status_history for select to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'qualification-files',
  'qualification-files',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins can read qualification files"
on storage.objects for select to authenticated
using (
  bucket_id = 'qualification-files'
  and exists (select 1 from public.admin_users a where a.user_id = auth.uid())
);
