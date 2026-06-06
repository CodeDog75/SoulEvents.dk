create policy "Public can create bookings"
on bookings for insert
with check (true);
