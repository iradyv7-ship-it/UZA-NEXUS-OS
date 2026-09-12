-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('learner', 'facilitator', 'admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can read their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('facilitator','admin'))
$$;

-- ============ CURRICULUM ============
CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title_en text NOT NULL,
  title_rw text NOT NULL,
  blurb_en text,
  blurb_rw text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.courses TO anon, authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Courses are public" ON public.courses FOR SELECT USING (true);
CREATE POLICY "Admins write courses" ON public.courses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  code text NOT NULL,
  title_en text NOT NULL,
  title_rw text NOT NULL,
  why_en text,
  why_rw text,
  minutes integer NOT NULL DEFAULT 30,
  delivery text NOT NULL DEFAULT 'both',
  tier text NOT NULL DEFAULT 'core',
  partner_en text,
  partner_rw text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.modules TO anon, authenticated;
GRANT ALL ON public.modules TO service_role;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Modules are public" ON public.modules FOR SELECT USING (true);
CREATE POLICY "Admins write modules" ON public.modules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  title_en text NOT NULL,
  title_rw text NOT NULL,
  body_en jsonb NOT NULL DEFAULT '[]'::jsonb,
  body_rw jsonb NOT NULL DEFAULT '[]'::jsonb,
  practice_en text,
  practice_rw text,
  facilitator_en text,
  facilitator_rw text,
  video_url text,
  audio_url_en text,
  audio_url_rw text,
  image_url text,
  resources jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lessons TO anon, authenticated;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lessons are public" ON public.lessons FOR SELECT USING (true);
CREATE POLICY "Admins write lessons" ON public.lessons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  module_id uuid REFERENCES public.modules(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'module_quiz',
  title_en text NOT NULL,
  title_rw text NOT NULL,
  pass_mark integer NOT NULL DEFAULT 70,
  max_attempts integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.assessments TO anon, authenticated;
GRANT ALL ON public.assessments TO service_role;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Assessments are public" ON public.assessments FOR SELECT USING (true);
CREATE POLICY "Admins write assessments" ON public.assessments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  prompt_en text NOT NULL,
  prompt_rw text NOT NULL,
  options_en jsonb NOT NULL,
  options_rw jsonb NOT NULL,
  correct_index integer NOT NULL,
  explain_en text,
  explain_rw text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- correct_index and explanations are deliberately NOT granted to learners.
GRANT SELECT (id, slug, assessment_id, prompt_en, prompt_rw, options_en, options_rw, sort_order) ON public.questions TO anon, authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Questions are readable" ON public.questions FOR SELECT USING (true);
CREATE POLICY "Admins write questions" ON public.questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ ATTEMPTS ============
CREATE TABLE public.assessment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score integer NOT NULL,
  total integer NOT NULL,
  passed boolean NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.assessment_attempts TO authenticated;
GRANT ALL ON public.assessment_attempts TO service_role;
ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Learners read their own attempts" ON public.assessment_attempts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Staff read all attempts" ON public.assessment_attempts
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.attempt_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.assessment_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  chosen_index integer NOT NULL,
  correct boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.attempt_answers TO authenticated;
GRANT ALL ON public.attempt_answers TO service_role;
ALTER TABLE public.attempt_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Learners read their own answers" ON public.attempt_answers
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.assessment_attempts a WHERE a.id = attempt_id AND a.user_id = auth.uid()));
CREATE POLICY "Staff read all answers" ON public.attempt_answers
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- ============ COHORTS, ENROLMENT, ATTENDANCE ============
ALTER TABLE public.cohorts
  ADD COLUMN IF NOT EXISTS ends_on date,
  ADD COLUMN IF NOT EXISTS facilitator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';
GRANT SELECT ON public.cohorts TO anon, authenticated;
GRANT ALL ON public.cohorts TO service_role;
CREATE POLICY "Admins write cohorts" ON public.cohorts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.enrolments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cohort_id uuid REFERENCES public.cohorts(id) ON DELETE SET NULL,
  mode text NOT NULL DEFAULT 'self_guided',
  status text NOT NULL DEFAULT 'active',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  graduated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, cohort_id)
);
GRANT SELECT, INSERT, UPDATE ON public.enrolments TO authenticated;
GRANT ALL ON public.enrolments TO service_role;
ALTER TABLE public.enrolments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Learners manage their own enrolment" ON public.enrolments
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Staff read enrolments" ON public.enrolments
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff update enrolments" ON public.enrolments
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.cohort_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  module_slug text,
  title_en text NOT NULL,
  title_rw text,
  scheduled_for date,
  location text,
  facilitator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cohort_sessions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cohort_sessions TO authenticated;
GRANT ALL ON public.cohort_sessions TO service_role;
ALTER TABLE public.cohort_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cohort schedule is public" ON public.cohort_sessions FOR SELECT USING (true);
CREATE POLICY "Staff manage cohort sessions" ON public.cohort_sessions FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.cohort_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  present boolean NOT NULL DEFAULT true,
  marked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  marked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Learners read their own attendance" ON public.attendance
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Staff read attendance" ON public.attendance
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff mark attendance" ON public.attendance
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ CERTIFICATES ============
CREATE TABLE public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cohort_id uuid REFERENCES public.cohorts(id) ON DELETE SET NULL,
  learner_name text NOT NULL,
  cohort_label text,
  modules_completed integer NOT NULL DEFAULT 0,
  final_score integer,
  issued_on date NOT NULL DEFAULT (now() AT TIME ZONE 'Africa/Kigali')::date,
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Learners read their own certificate" ON public.certificates
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Staff read certificates" ON public.certificates
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- Public verification: exposes only what a bank officer needs.
CREATE OR REPLACE FUNCTION public.verify_certificate(_certificate_id text)
RETURNS TABLE (certificate_id text, learner_name text, cohort_label text, issued_on date, valid boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.certificate_id, c.learner_name, c.cohort_label, c.issued_on, c.revoked_at IS NULL
  FROM public.certificates c
  WHERE upper(trim(c.certificate_id)) = upper(trim(_certificate_id))
$$;
GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated;

-- ============ PARTNER SPONSORSHIP ============
CREATE TABLE public.partner_sponsorships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.partner_orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_sponsorships TO authenticated;
GRANT ALL ON public.partner_sponsorships TO service_role;
ALTER TABLE public.partner_sponsorships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partners manage their own sponsorships" ON public.partner_sponsorships
  FOR ALL TO authenticated
  USING (org_id IN (SELECT public.my_partner_org_ids()))
  WITH CHECK (org_id IN (SELECT public.my_partner_org_ids()));
CREATE POLICY "Learners see who sponsors them" ON public.partner_sponsorships
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Staff read sponsorships" ON public.partner_sponsorships
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.sponsors_learner(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.partner_sponsorships s
    WHERE s.user_id = _user AND s.status = 'active'
      AND s.org_id IN (SELECT public.my_partner_org_ids())
  )
$$;

CREATE POLICY "Sponsoring partners read learner progress" ON public.module_progress
  FOR SELECT TO authenticated USING (public.sponsors_learner(user_id));
CREATE POLICY "Staff read learner progress" ON public.module_progress
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Sponsoring partners read attempts" ON public.assessment_attempts
  FOR SELECT TO authenticated USING (public.sponsors_learner(user_id));
CREATE POLICY "Sponsoring partners read certificates" ON public.certificates
  FOR SELECT TO authenticated USING (public.sponsors_learner(user_id));
CREATE POLICY "Staff read learner profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- ============ TIMESTAMP TRIGGERS ============
CREATE TRIGGER courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER modules_updated_at BEFORE UPDATE ON public.modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER lessons_updated_at BEFORE UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER assessments_updated_at BEFORE UPDATE ON public.assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER enrolments_updated_at BEFORE UPDATE ON public.enrolments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER cohort_sessions_updated_at BEFORE UPDATE ON public.cohort_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER certificates_updated_at BEFORE UPDATE ON public.certificates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER sponsorships_updated_at BEFORE UPDATE ON public.partner_sponsorships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Every new user is a learner; facilitator/admin is granted deliberately.
CREATE OR REPLACE FUNCTION public.grant_default_learner_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'learner')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_profile_created_grant_learner
AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.grant_default_learner_role();
