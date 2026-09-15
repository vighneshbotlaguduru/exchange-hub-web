-- Alert visibility is calculated at read time, so it expands automatically while an alert is active:
-- 0-5 min: 2 km; 5-10 min: 4 km; 10-15 min: 6 km; then it is no longer visible.
drop policy if exists emergency_read on public.emergency_requests;
create policy emergency_read on public.emergency_requests for select using (
  requester_id = auth.uid()
  or exists (
    select 1 from public.member_locations l
    where l.user_id = auth.uid() and l.updated_at > now() - interval '1 hour'
    and 6371 * 2 * asin(sqrt(
      power(sin(radians(l.latitude - emergency_requests.latitude) / 2), 2)
      + cos(radians(emergency_requests.latitude)) * cos(radians(l.latitude))
      * power(sin(radians(l.longitude - emergency_requests.longitude) / 2), 2)
    )) <= case
      when now() < emergency_requests.created_at + interval '5 minutes' then 2
      when now() < emergency_requests.created_at + interval '10 minutes' then 4
      when now() < emergency_requests.expires_at then 6
      else 0
    end
  )
);

-- Recipient rows are no longer used for visibility; keep them private to requesters.
drop policy if exists recipients_read on public.emergency_recipients;
create policy recipients_read on public.emergency_recipients for select using (
  exists (select 1 from public.emergency_requests e where e.id = emergency_request_id and e.requester_id = auth.uid())
);

create or replace function public.create_emergency_request(p_item_title text,p_note text,p_latitude numeric,p_longitude numeric) returns jsonb language plpgsql security definer set search_path=public as $$
declare request_id uuid; recipient_count integer;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if char_length(trim(p_item_title)) not between 2 and 140 then raise exception 'Invalid item title'; end if;
  insert into public.emergency_requests(requester_id,item_title,note,latitude,longitude,expires_at)
  values(auth.uid(),trim(p_item_title),left(trim(coalesce(p_note,'')),500),p_latitude,p_longitude,now()+interval '15 minutes') returning id into request_id;
  select count(*) into recipient_count from public.member_locations l where l.user_id <> auth.uid() and l.updated_at > now()-interval '1 hour' and 6371*2*asin(sqrt(power(sin(radians(l.latitude-p_latitude)/2),2)+cos(radians(p_latitude))*cos(radians(l.latitude))*power(sin(radians(l.longitude-p_longitude)/2),2))) <= 2;
  return jsonb_build_object('requestId',request_id,'recipientCount',recipient_count);
end $$;
