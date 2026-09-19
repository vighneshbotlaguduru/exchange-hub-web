-- Keep borrow requests consistent with the listing being requested.
drop policy if exists requests_insert on public.borrow_requests;
create policy requests_insert on public.borrow_requests for insert with check (
  borrower_id = auth.uid()
  and exists (
    select 1 from public.listings l
    where l.id = listing_id
      and l.owner_id = owner_id
      and l.owner_id <> auth.uid()
      and l.status = 'approved'
      and l.available = true
  )
);

-- Administrators can moderate conversations attached to requests they can see.
drop policy if exists messages_access on public.messages;
create policy messages_access on public.messages for select using (
  exists (
    select 1 from public.borrow_requests r
    where r.id = borrow_request_id
      and (r.borrower_id = auth.uid() or r.owner_id = auth.uid() or public.is_admin())
  )
);
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.borrow_requests r
    where r.id = borrow_request_id
      and (r.borrower_id = auth.uid() or r.owner_id = auth.uid() or public.is_admin())
  )
);

alter table public.emergency_requests
  add constraint emergency_latitude_range check (latitude between -90 and 90),
  add constraint emergency_longitude_range check (longitude between -180 and 180);

drop policy if exists requests_update_admin on public.borrow_requests;
create policy requests_update_admin on public.borrow_requests for update
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.create_emergency_request(p_item_title text,p_note text,p_latitude numeric,p_longitude numeric) returns jsonb language plpgsql security definer set search_path=public as $$
declare request_id uuid; recipient_count integer;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then raise exception 'Invalid location'; end if;
  if char_length(trim(p_item_title)) not between 2 and 140 then raise exception 'Invalid item title'; end if;
  insert into public.emergency_requests(requester_id,item_title,note,latitude,longitude,expires_at)
  values(auth.uid(),trim(p_item_title),left(trim(coalesce(p_note,'')),500),p_latitude,p_longitude,now()+interval '15 minutes') returning id into request_id;
  select count(*) into recipient_count from public.member_locations l where l.user_id <> auth.uid() and l.updated_at > now()-interval '1 hour' and 6371*2*asin(sqrt(power(sin(radians(l.latitude-p_latitude)/2),2)+cos(radians(p_latitude))*cos(radians(l.latitude))*power(sin(radians(l.longitude-p_longitude)/2),2))) <= 2;
  return jsonb_build_object('requestId',request_id,'recipientCount',recipient_count);
end $$;
