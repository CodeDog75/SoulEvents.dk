alter table ads
add column if not exists homepage_placement text not null default 'bottom'
check (homepage_placement in ('middle', 'bottom'));

create index if not exists ads_homepage_placement_active_idx
on ads (is_active, show_on_homepage, homepage_placement, priority, created_at);
