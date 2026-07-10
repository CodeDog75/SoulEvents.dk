alter table weekly_reflections
add column if not exists image_path text,
add column if not exists image_alt_text text;
