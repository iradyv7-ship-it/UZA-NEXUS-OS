-- Trigger-only functions: never callable from the API.
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_partner_org() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.keep_partner_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_partner_owner() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_default_learner_role() FROM PUBLIC, anon, authenticated;

-- Policy helpers: needed by signed-in policy evaluation only, never by anonymous callers.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sponsors_learner(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_partner_org_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_partner_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sponsors_learner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_partner_org_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_partner_member(uuid, uuid) TO authenticated;
