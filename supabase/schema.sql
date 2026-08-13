-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query)

create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  answers jsonb not null,
  domain_scores jsonb not null,
  composite int not null,
  attention_passed boolean not null default true,
  reviewed boolean not null default false,
  note text default ''
);

alter table checkins enable row level security;

-- Staff can submit a check-in without logging in.
create policy "anyone can insert a checkin"
  on checkins for insert
  with check (true);

-- Only logged-in reviewers (Brain Performance Center staff) can read check-ins.
create policy "authenticated users can read checkins"
  on checkins for select
  using (auth.role() = 'authenticated');

-- Only logged-in reviewers can update review status / notes.
create policy "authenticated users can update checkins"
  on checkins for update
  using (auth.role() = 'authenticated');

-- No public delete policy is defined, so no one can delete from the client.
