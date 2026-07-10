alter table weekly_reflections
drop constraint if exists weekly_reflections_background_color_check;

alter table weekly_reflections
add constraint weekly_reflections_background_color_check
check (
  background_color ~ '^#[0-9A-Fa-f]{6}$'
  or background_color in (
    'gradient:lavender-cream',
    'gradient:sage-sand',
    'gradient:dusty-purple-beige',
    'gradient:warm-grey-cream'
  )
);
