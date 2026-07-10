insert into public.site_settings (key, value)
values ('about_page_content', null)
on conflict (key) do nothing;
