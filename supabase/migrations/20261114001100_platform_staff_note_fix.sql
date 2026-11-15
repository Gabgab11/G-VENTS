-- stefaneey@gmail.com is G-ventZ's engineer, not its founder (the bootstrap in
-- 20261024000300_platform_staff.sql labelled them "founder"). Removes that label; staff access is
-- unchanged. Only the original bootstrap value is touched, so a note set since stays as it is.

update public.platform_staff
   set note = null
 where email = 'stefaneey@gmail.com'
   and note = 'founder';
