alter table ads
add column if not exists show_title_on_banner boolean not null default true,
add column if not exists show_sponsor_on_banner boolean not null default true;
