alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text;

update public.profiles
set
  first_name = case
    when first_name is null and full_name is not null and btrim(full_name) <> '' then
      case
        when btrim(full_name) ~ '\s' then regexp_replace(btrim(full_name), '\s+\S+$', '')
        else btrim(full_name)
      end
    else first_name
  end,
  last_name = case
    when last_name is null and full_name is not null and btrim(full_name) <> '' and btrim(full_name) ~ '\s' then
      regexp_replace(btrim(full_name), '^.*\s+', '')
    else last_name
  end;
