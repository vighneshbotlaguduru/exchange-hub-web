-- Fix: Allow admin and request parties to update borrow_requests (accept, decline, return)
drop policy if exists requests_update on public.borrow_requests;
create policy requests_update on public.borrow_requests for update
  using (borrower_id = auth.uid() or owner_id = auth.uid() or public.is_admin())
  with check (borrower_id = auth.uid() or owner_id = auth.uid() or public.is_admin());

-- Realtime publication additions for instant zero-refresh updates
alter publication supabase_realtime add table public.borrow_requests;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.listings;
alter publication supabase_realtime add table public.emergency_requests;
alter publication supabase_realtime add table public.emergency_recipients;
