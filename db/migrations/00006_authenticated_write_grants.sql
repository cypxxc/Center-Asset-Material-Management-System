-- Server actions use the authenticated user's session and are constrained by RLS.

grant insert, update, delete on public.categories to authenticated;
grant insert, update, delete on public.locations to authenticated;
grant insert, update, delete on public.units to authenticated;
grant update on public.profiles to authenticated;
