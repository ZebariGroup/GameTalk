CREATE TABLE public.rooms (
  code TEXT PRIMARY KEY,
  max_members INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.rooms FOR INSERT WITH CHECK (true);
