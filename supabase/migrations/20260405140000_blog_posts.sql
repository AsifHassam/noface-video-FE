-- Blog posts for public site + admin editor (writes via service role API)
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  excerpt text not null,
  body_markdown text not null default '',
  author text not null default 'noface.video team',
  published_at date not null default (current_date),
  hero_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_posts_published_at_idx on public.blog_posts (published_at desc);

alter table public.blog_posts enable row level security;

-- Public marketing site reads posts with anon key
create policy "blog_posts_select_public"
on public.blog_posts
for select
to anon, authenticated
using (true);

-- Inserts/updates/deletes go through Next.js API with service role (bypasses RLS)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog-images',
  'blog-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Anyone can read images in marketing pages
drop policy if exists "Public read blog images" on storage.objects;
create policy "Public read blog images"
on storage.objects
for select
to public
using (bucket_id = 'blog-images');
