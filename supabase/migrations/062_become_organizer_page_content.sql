insert into public.site_settings (key, value)
values ('become_organizer_page_content', null)
on conflict (key) do nothing;
