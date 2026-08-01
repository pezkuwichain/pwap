-- Perwerde (Education) Tables
-- Courses Table (ID comes from blockchain)
CREATE TABLE IF NOT EXISTS public.courses (
  id BIGINT PRIMARY KEY, -- Blockchain course_id
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  content_link TEXT, -- IPFS hash
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Enrollments Table
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_address TEXT NOT NULL,
  course_id BIGINT REFERENCES public.courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  points_earned INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  UNIQUE(student_address, course_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_courses_status ON public.courses(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.enrollments(student_address);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON public.enrollments(course_id);

-- RLS Policies
-- Courses
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view courses" ON public.courses;
CREATE POLICY "Anyone can view courses"
  ON public.courses FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage courses" ON public.courses;
CREATE POLICY "Admins can manage courses"
  ON public.courses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE user_id = auth.uid()
    )
  );

-- Enrollments
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own enrollments" ON public.enrollments;
CREATE POLICY "Users can view their own enrollments"
  ON public.enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.wallets
      WHERE user_id = auth.uid() AND address = student_address
    )
  );

DROP POLICY IF EXISTS "Users can create their own enrollments" ON public.enrollments;
CREATE POLICY "Users can create their own enrollments"
  ON public.enrollments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.wallets
      WHERE user_id = auth.uid() AND address = student_address
    )
  );

DROP POLICY IF EXISTS "Admins or course owners can update enrollments" ON public.enrollments;
CREATE POLICY "Admins or course owners can update enrollments"
  ON public.enrollments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.courses c
      JOIN public.wallets w ON c.owner = w.address
      WHERE c.id = course_id AND w.user_id = auth.uid()
    )
  );
