-- Create appointments table for the Today's Schedule dashboard panel
CREATE TABLE IF NOT EXISTS public.appointments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  date        date        NOT NULL,
  start_time  time        NOT NULL,
  end_time    time        NOT NULL,
  project_id  uuid        REFERENCES public.projects(id) ON DELETE SET NULL,
  notes       text,
  created_at  timestamptz DEFAULT now()
);

-- Enable row-level security
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own appointments
CREATE POLICY "Users can manage their own appointments"
  ON public.appointments
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast "today's appointments" queries
CREATE INDEX IF NOT EXISTS appointments_user_date_idx
  ON public.appointments (user_id, date);
