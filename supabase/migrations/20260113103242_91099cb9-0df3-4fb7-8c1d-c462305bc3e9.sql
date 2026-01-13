-- Create enums for project statuses
CREATE TYPE public.project_status AS ENUM ('draft', 'sent', 'in_progress', 'completed');
CREATE TYPE public.scope_category AS ENUM ('included', 'excluded', 'assumption');
CREATE TYPE public.change_request_type AS ENUM ('client_request', 'site_issue', 'substitution');
CREATE TYPE public.change_request_status AS ENUM ('pending', 'approved', 'declined');
CREATE TYPE public.stage_status AS ENUM ('upcoming', 'current', 'completed');

-- Create projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  status public.project_status NOT NULL DEFAULT 'draft',
  total_value NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create scope_items table
CREATE TABLE public.scope_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category public.scope_category NOT NULL DEFAULT 'included',
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create change_requests table
CREATE TABLE public.change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type public.change_request_type NOT NULL DEFAULT 'client_request',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reason TEXT,
  cost_impact NUMERIC DEFAULT 0,
  time_impact TEXT,
  status public.change_request_status NOT NULL DEFAULT 'pending',
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create project_stages table
CREATE TABLE public.project_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status public.stage_status NOT NULL DEFAULT 'upcoming',
  stage_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scope_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_stages ENABLE ROW LEVEL SECURITY;

-- Projects RLS: Owners can CRUD, anyone can read (for client links)
CREATE POLICY "Project owners can manage their projects"
ON public.projects
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view projects"
ON public.projects
FOR SELECT
USING (true);

-- Scope items RLS: Project owners can CRUD, anyone can read
CREATE POLICY "Project owners can manage scope items"
ON public.scope_items
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = scope_items.project_id 
    AND projects.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = scope_items.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Anyone can view scope items"
ON public.scope_items
FOR SELECT
USING (true);

-- Anyone can update scope items (for client acknowledgements)
CREATE POLICY "Anyone can acknowledge scope items"
ON public.scope_items
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Change requests RLS: Project owners can CRUD, anyone can read and insert
CREATE POLICY "Project owners can manage change requests"
ON public.change_requests
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = change_requests.project_id 
    AND projects.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = change_requests.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Anyone can view change requests"
ON public.change_requests
FOR SELECT
USING (true);

CREATE POLICY "Anyone can submit change requests"
ON public.change_requests
FOR INSERT
WITH CHECK (true);

-- Project stages RLS: Project owners can CRUD, anyone can read
CREATE POLICY "Project owners can manage project stages"
ON public.project_stages
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_stages.project_id 
    AND projects.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_stages.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Anyone can view project stages"
ON public.project_stages
FOR SELECT
USING (true);

-- Add triggers for updated_at
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scope_items_updated_at
BEFORE UPDATE ON public.scope_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_stages_updated_at
BEFORE UPDATE ON public.project_stages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_scope_items_project_id ON public.scope_items(project_id);
CREATE INDEX idx_change_requests_project_id ON public.change_requests(project_id);
CREATE INDEX idx_project_stages_project_id ON public.project_stages(project_id);