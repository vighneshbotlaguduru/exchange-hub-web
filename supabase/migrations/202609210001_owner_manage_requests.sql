-- Migration: Allow Item Owners to Manage Borrow Requests & Auto-Update Availability
-- 1. Ensure item owners can update listing availability when loaning or accepting returns
drop policy if exists listings_update on public.listings;
create policy listings_update on public.listings for update
  using (owner_id = auth.uid() or public.is_admin())
  with check (
    public.is_admin()
    or (
      owner_id = auth.uid()
      and (
        (status = 'pending' and available = false)
        or (status = 'approved')
      )
    )
  );

-- 2. Database trigger on borrow_requests: automatically manage listing availability when accepted or returned
create or replace function public.on_borrow_request_status_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status = 'accepted' then
    update public.listings set available = false where id = new.listing_id;
  elsif new.status in ('returned', 'declined', 'cancelled') then
    if not exists (
      select 1 from public.borrow_requests
      where listing_id = new.listing_id and status = 'accepted' and id <> new.id
    ) then
      update public.listings set available = true where id = new.listing_id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_borrow_request_status on public.borrow_requests;
create trigger trg_borrow_request_status
  after update on public.borrow_requests
  for each row execute function public.on_borrow_request_status_change();
