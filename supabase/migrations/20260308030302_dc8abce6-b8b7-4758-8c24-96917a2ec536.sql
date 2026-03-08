
-- Role enum
CREATE TYPE public.app_role AS ENUM ('student', 'advisor');

-- User roles table (RBAC best practice - separate from profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own role on signup" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  department TEXT DEFAULT '',
  student_id TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Advisor availability (weekly schedule)
CREATE TABLE public.advisor_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advisor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_duration_minutes INT NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (advisor_id, day_of_week)
);
ALTER TABLE public.advisor_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Availability viewable by authenticated" ON public.advisor_availability FOR SELECT TO authenticated USING (true);
CREATE POLICY "Advisors can manage own availability" ON public.advisor_availability FOR INSERT WITH CHECK (auth.uid() = advisor_id AND public.has_role(auth.uid(), 'advisor'));
CREATE POLICY "Advisors can update own availability" ON public.advisor_availability FOR UPDATE USING (auth.uid() = advisor_id AND public.has_role(auth.uid(), 'advisor'));
CREATE POLICY "Advisors can delete own availability" ON public.advisor_availability FOR DELETE USING (auth.uid() = advisor_id AND public.has_role(auth.uid(), 'advisor'));

-- Appointments
CREATE TYPE public.appointment_status AS ENUM ('booked', 'completed', 'incomplete', 'cancelled');

CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  advisor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status appointment_status NOT NULL DEFAULT 'booked',
  reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view own appointments" ON public.appointments FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Advisors can view their appointments" ON public.appointments FOR SELECT USING (auth.uid() = advisor_id);
CREATE POLICY "Students can book appointments" ON public.appointments FOR INSERT WITH CHECK (auth.uid() = student_id AND public.has_role(auth.uid(), 'student'));
CREATE POLICY "Advisors can update appointment status" ON public.appointments FOR UPDATE USING (auth.uid() = advisor_id AND public.has_role(auth.uid(), 'advisor'));
CREATE POLICY "Students can cancel own appointments" ON public.appointments FOR UPDATE USING (auth.uid() = student_id AND public.has_role(auth.uid(), 'student'));

-- Walk-in queue
CREATE TYPE public.queue_status AS ENUM ('waiting', 'serving', 'done');

CREATE TABLE public.walk_in_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  advisor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status queue_status NOT NULL DEFAULT 'waiting',
  reason TEXT DEFAULT '',
  queue_number INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.walk_in_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view own queue" ON public.walk_in_queue FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Advisors can view their queue" ON public.walk_in_queue FOR SELECT USING (auth.uid() = advisor_id);
CREATE POLICY "Students can join queue" ON public.walk_in_queue FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Advisors can update queue status" ON public.walk_in_queue FOR UPDATE USING (auth.uid() = advisor_id AND public.has_role(auth.uid(), 'advisor'));

-- Case notes
CREATE TABLE public.case_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  walk_in_id UUID REFERENCES public.walk_in_queue(id) ON DELETE SET NULL,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  advisor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notes TEXT NOT NULL DEFAULT '',
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Advisors can view their case notes" ON public.case_notes FOR SELECT USING (auth.uid() = advisor_id);
CREATE POLICY "Students can view non-private notes" ON public.case_notes FOR SELECT USING (auth.uid() = student_id AND is_private = false);
CREATE POLICY "Advisors can create case notes" ON public.case_notes FOR INSERT WITH CHECK (auth.uid() = advisor_id AND public.has_role(auth.uid(), 'advisor'));
CREATE POLICY "Advisors can update their case notes" ON public.case_notes FOR UPDATE USING (auth.uid() = advisor_id AND public.has_role(auth.uid(), 'advisor'));

-- Referrals
CREATE TYPE public.referral_status AS ENUM ('pending', 'accepted', 'declined');

CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_advisor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_advisor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT '',
  status referral_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "From advisor can view referrals" ON public.referrals FOR SELECT USING (auth.uid() = from_advisor_id);
CREATE POLICY "To advisor can view referrals" ON public.referrals FOR SELECT USING (auth.uid() = to_advisor_id);
CREATE POLICY "Students can view own referrals" ON public.referrals FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Advisors can create referrals" ON public.referrals FOR INSERT WITH CHECK (auth.uid() = from_advisor_id AND public.has_role(auth.uid(), 'advisor'));
CREATE POLICY "Target advisor can update referral" ON public.referrals FOR UPDATE USING (auth.uid() = to_advisor_id AND public.has_role(auth.uid(), 'advisor'));

-- Notifications
CREATE TYPE public.notification_type AS ENUM ('appointment_booked', 'referral_received', 'appointment_reminder', 'queue_update');

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT false,
  related_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Authenticated can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_advisor_availability_updated_at BEFORE UPDATE ON public.advisor_availability FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_walk_in_queue_updated_at BEFORE UPDATE ON public.walk_in_queue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_case_notes_updated_at BEFORE UPDATE ON public.case_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_referrals_updated_at BEFORE UPDATE ON public.referrals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
