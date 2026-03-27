-- Remove permissive public policies on rooms (clients use server API + service role only).
DROP POLICY IF EXISTS "Allow public read" ON public.rooms;
DROP POLICY IF EXISTS "Allow public insert" ON public.rooms;

-- No SELECT/INSERT for anon/authenticated on rooms; access is via API using service role.

-- Membership rows for server-enforced kid caps (API calls SECURITY DEFINER RPCs).
CREATE TABLE public.room_members (
  room_code TEXT NOT NULL REFERENCES public.rooms (code) ON DELETE CASCADE,
  member_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('kid', 'observer')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  PRIMARY KEY (room_code, member_id)
);

CREATE INDEX idx_room_members_room_code ON public.room_members (room_code);

ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

-- Atomic join: observers always allowed; kids blocked when at max_members (re-join same member_id allowed).
CREATE OR REPLACE FUNCTION public.try_join_room(p_code TEXT, p_member_id TEXT, p_role TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  kid_count INT;
  already_member BOOLEAN;
BEGIN
  IF p_role NOT IN ('kid', 'observer') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_role');
  END IF;

  IF p_member_id IS NULL OR length(trim(p_member_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_member');
  END IF;

  SELECT * INTO r FROM public.rooms WHERE code = p_code FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF r.expires_at IS NOT NULL AND r.expires_at < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.room_members
    WHERE room_code = p_code AND member_id = p_member_id
  )
  INTO already_member;

  IF p_role = 'kid' AND NOT already_member THEN
    SELECT COUNT(*)::INT INTO kid_count
    FROM public.room_members
    WHERE room_code = p_code AND role = 'kid';

    IF kid_count >= r.max_members THEN
      RETURN jsonb_build_object('ok', false, 'error', 'full');
    END IF;
  END IF;

  INSERT INTO public.room_members (room_code, member_id, role)
  VALUES (p_code, p_member_id, p_role)
  ON CONFLICT (room_code, member_id) DO UPDATE
  SET
    role = EXCLUDED.role,
    joined_at = NOW();

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_room(p_code TEXT, p_member_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.room_members
  WHERE room_code = p_code AND member_id = p_member_id;
END;
$$;

REVOKE ALL ON FUNCTION public.try_join_room (TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_join_room (TEXT, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.leave_room (TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_room (TEXT, TEXT) TO service_role;
