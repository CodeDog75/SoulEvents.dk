alter table ads
add column if not exists show_on_homepage boolean not null default false;

create index if not exists ads_homepage_active_idx
on ads (is_active, show_on_homepage, priority, created_at);
