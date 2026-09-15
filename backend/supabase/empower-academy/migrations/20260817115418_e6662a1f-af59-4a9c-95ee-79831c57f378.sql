CREATE TYPE public.partner_kind AS ENUM ('rnp', 'driving_school', 'bank', 'garage', 'employer');
CREATE TYPE public.partner_status AS ENUM ('pending', 'approved', 'suspended');

CREATE TABLE public.partner_orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind public.partner_kind NOT NULL,
  district text,
  about text,
  contact_name text,
  contact_email text,
  contact_phone text,
  status public.partner_status NOT NULL DEFAULT 'pending',
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.partner_orgs TO anon;
GRANT SELECT, INSERT, UPDATE ON public.partner_orgs TO authenticated;
GRANT ALL ON public.partner_orgs TO service_role;

CREATE TABLE public.partner_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.partner_orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.partner_members TO authenticated;
GRANT ALL ON public.partner_members TO service_role;

CREATE TABLE public.partner_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.partner_orgs(id) ON DELETE CASCADE,
  cohort_id uuid REFERENCES public.cohorts(id) ON DELETE SET NULL,
  track text,
  title text NOT NULL,
  scheduled_for date,
  location text,
  notes text,
  learners_present integer,
  status text NOT NULL DEFAULT 'planned',
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_sessions TO authenticated;
GRANT ALL ON public.partner_sessions TO service_role;

CREATE OR REPLACE FUNCTION public.is_partner_member(_org uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.partner_members WHERE org_id = _org AND user_id = _user)
$$;

CREATE OR REPLACE FUNCTION public.my_partner_org_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.partner_members WHERE user_id = auth.uid()
$$;

ALTER TABLE public.partner_orgs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved partners are publicly listed" ON public.partner_orgs
  FOR SELECT USING (status = 'approved');
CREATE POLICY "Members can view their own organisation" ON public.partner_orgs
  FOR SELECT TO authenticated USING (public.is_partner_member(id, auth.uid()) OR created_by = auth.uid());
CREATE POLICY "Signed-in users can apply as a partner" ON public.partner_orgs
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Members can edit their own organisation" ON public.partner_orgs
  FOR UPDATE TO authenticated USING (public.is_partner_member(id, auth.uid()))
  WITH CHECK (public.is_partner_member(id, auth.uid()));

ALTER TABLE public.partner_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view their organisation roster" ON public.partner_members
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR org_id IN (SELECT public.my_partner_org_ids()));
CREATE POLICY "Owners can add members" ON public.partner_members
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.partner_members m WHERE m.org_id = org_id AND m.user_id = auth.uid() AND m.role = 'owner')
  );
CREATE POLICY "Members can leave or be removed by an owner" ON public.partner_members
  FOR DELETE TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.partner_members m WHERE m.org_id = partner_members.org_id AND m.user_id = auth.uid() AND m.role = 'owner')
  );

ALTER TABLE public.partner_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partner staff manage their own sessions" ON public.partner_sessions
  FOR ALL TO authenticated
  USING (org_id IN (SELECT public.my_partner_org_ids()))
  WITH CHECK (org_id IN (SELECT public.my_partner_org_ids()));

-- The applicant becomes the first owner, and status stays under UZA control.
CREATE OR REPLACE FUNCTION public.handle_new_partner_org()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.status := 'pending';
  RETURN NEW;
END;
$$;
CREATE TRIGGER partner_orgs_force_pending BEFORE INSERT ON public.partner_orgs
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_partner_org();

CREATE OR REPLACE FUNCTION public.add_partner_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.partner_members (org_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT (org_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER partner_orgs_add_owner AFTER INSERT ON public.partner_orgs
  FOR EACH ROW EXECUTE FUNCTION public.add_partner_owner();

CREATE OR REPLACE FUNCTION public.keep_partner_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.status := OLD.status;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER partner_orgs_keep_status BEFORE UPDATE ON public.partner_orgs
  FOR EACH ROW EXECUTE FUNCTION public.keep_partner_status();

CREATE TRIGGER partner_sessions_updated_at BEFORE UPDATE ON public.partner_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
