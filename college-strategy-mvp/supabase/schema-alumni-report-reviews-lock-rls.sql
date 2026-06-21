-- Prevent alumni users from self-approving or editing submitted/approved reviews via direct Supabase access.

drop policy if exists "alumni_reviews_insert_own" on public.alumni_report_reviews;
drop policy if exists "alumni_reviews_update_own" on public.alumni_report_reviews;

create policy "alumni_reviews_insert_own"
  on public.alumni_report_reviews for insert
  with check (
    auth.uid() = user_id
    and status in ('draft', 'submitted')
    and approved_at is null
    and approved_by is null
  );

create policy "alumni_reviews_update_own"
  on public.alumni_report_reviews for update
  using (auth.uid() = user_id and status = 'draft')
  with check (
    auth.uid() = user_id
    and status in ('draft', 'submitted')
    and approved_at is null
    and approved_by is null
  );
