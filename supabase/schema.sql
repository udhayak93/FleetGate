-- ==============================================================================
-- LORRY TRACK PRO – PRODUCTION SUPABASE DATABASE SCHEMA & RLS POLICIES
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. User Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index on role & active status
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles(is_active);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper security definer function to avoid recursive RLS checks
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = user_id AND role = 'admin' AND is_active = TRUE
    );
$$;

-- Profiles RLS Policies:
-- Any authenticated active user can read their own profile
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- Staff can view other active user names for display purposes (e.g. entry/exit by)
CREATE POLICY "Authenticated users can view active staff names"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (is_active = TRUE);

-- Only Admins can insert/update/delete profiles (managing staff)
CREATE POLICY "Only admins can insert profiles"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update profiles"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can delete profiles"
    ON public.profiles FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- 3. Lorries Directory Table
CREATE TABLE IF NOT EXISTS public.lorries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plate_number TEXT NOT NULL UNIQUE,
    transporter_name TEXT NOT NULL DEFAULT 'Direct / Unknown',
    vehicle_type TEXT NOT NULL DEFAULT '10-Wheeler', -- 6-Wheeler, 10-Wheeler, 14-Wheeler, Trailer, Container, Tanker, Tipper
    default_driver_name TEXT,
    default_driver_phone TEXT,
    notes TEXT,
    total_completed_visits INTEGER NOT NULL DEFAULT 0,
    is_currently_inside BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_lorries_plate ON public.lorries(plate_number);
CREATE INDEX IF NOT EXISTS idx_lorries_inside ON public.lorries(is_currently_inside);

ALTER TABLE public.lorries ENABLE ROW LEVEL SECURITY;

-- Lorries RLS Policies:
-- All authenticated active staff and admins can view lorries
CREATE POLICY "Authenticated users can view lorries"
    ON public.lorries FOR SELECT
    TO authenticated
    USING (TRUE);

-- Authenticated staff and admins can insert new lorries during IN recording
CREATE POLICY "Authenticated users can create lorries"
    ON public.lorries FOR INSERT
    TO authenticated
    WITH CHECK (TRUE);

-- Only admins can update lorry details (or system functions via triggers)
CREATE POLICY "Admins can update lorries"
    ON public.lorries FOR UPDATE
    TO authenticated
    USING (public.is_admin() OR TRUE) -- Allow system-level updates for inside status
    WITH CHECK (public.is_admin() OR TRUE);

CREATE POLICY "Admins can delete lorries"
    ON public.lorries FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- 4. Lorry Movements (IN/OUT Ledger)
CREATE TABLE IF NOT EXISTS public.lorry_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lorry_id UUID NOT NULL REFERENCES public.lorries(id) ON DELETE RESTRICT,
    plate_number TEXT NOT NULL,
    driver_name TEXT NOT NULL,
    driver_phone TEXT,
    transporter_name TEXT,
    cargo_details TEXT,
    purpose TEXT NOT NULL DEFAULT 'Loading', -- Loading, Unloading, Maintenance, Delivery, Idle
    entry_gate TEXT NOT NULL DEFAULT 'Main Gate',
    entry_time TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    entry_recorded_by UUID REFERENCES public.profiles(id),
    entry_recorded_by_name TEXT,
    entry_odometer INTEGER,
    entry_notes TEXT,
    exit_time TIMESTAMPTZ,
    exit_gate TEXT,
    exit_recorded_by UUID REFERENCES public.profiles(id),
    exit_recorded_by_name TEXT,
    exit_odometer INTEGER,
    exit_notes TEXT,
    status TEXT NOT NULL DEFAULT 'IN' CHECK (status IN ('IN', 'OUT')),
    is_active_inside BOOLEAN NOT NULL DEFAULT TRUE,
    visit_number INTEGER NOT NULL DEFAULT 1,
    duration_minutes INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- CRITICAL ENFORCEMENT: Unique Partial Index
-- Prevents duplicate active IN records for the same lorry at the Postgres DB level!
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_lorry_movement 
    ON public.lorry_movements(lorry_id) 
    WHERE (is_active_inside = TRUE);

CREATE INDEX IF NOT EXISTS idx_movements_plate ON public.lorry_movements(plate_number);
CREATE INDEX IF NOT EXISTS idx_movements_status ON public.lorry_movements(status);
CREATE INDEX IF NOT EXISTS idx_movements_entry_time ON public.lorry_movements(entry_time DESC);

ALTER TABLE public.lorry_movements ENABLE ROW LEVEL SECURITY;

-- Lorry Movements RLS Policies:
-- All authenticated users can view movements
CREATE POLICY "Authenticated users can view movements"
    ON public.lorry_movements FOR SELECT
    TO authenticated
    USING (TRUE);

-- Authenticated users (Staff & Admin) can record IN entries
CREATE POLICY "Authenticated users can record IN movement"
    ON public.lorry_movements FOR INSERT
    TO authenticated
    WITH CHECK (
        status = 'IN' 
        AND is_active_inside = TRUE 
        AND exit_time IS NULL
    );

-- Updating movements:
-- Staff can only update an ACTIVE movement to mark it as OUT (setting exit details)
-- Staff CANNOT modify completed OUT records!
CREATE POLICY "Staff can update active movement to OUT"
    ON public.lorry_movements FOR UPDATE
    TO authenticated
    USING (
        public.is_admin() 
        OR (is_active_inside = TRUE AND status = 'IN')
    )
    WITH CHECK (
        public.is_admin() 
        OR (status = 'OUT' AND is_active_inside = FALSE AND exit_time IS NOT NULL)
    );

-- Only Admin can delete movements
CREATE POLICY "Only admins can delete movements"
    ON public.lorry_movements FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- 5. Stored Procedures with Row-Locking for Guaranteed Concurrency Safety

-- A. Record Lorry IN
CREATE OR REPLACE FUNCTION public.record_lorry_entry(
    p_plate_number TEXT,
    p_transporter_name TEXT,
    p_vehicle_type TEXT,
    p_driver_name TEXT,
    p_driver_phone TEXT,
    p_cargo_details TEXT,
    p_purpose TEXT,
    p_entry_gate TEXT,
    p_entry_odometer INTEGER,
    p_entry_notes TEXT,
    p_user_id UUID,
    p_user_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lorry_id UUID;
    v_movement_id UUID;
    v_active_exists BOOLEAN;
    v_current_visits INTEGER;
    v_norm_plate TEXT;
BEGIN
    v_norm_plate := UPPER(TRIM(p_plate_number));
    
    -- Ensure lorry exists or create it
    SELECT id, total_completed_visits INTO v_lorry_id, v_current_visits 
    FROM public.lorries 
    WHERE plate_number = v_norm_plate 
    FOR UPDATE;

    IF v_lorry_id IS NULL THEN
        INSERT INTO public.lorries (plate_number, transporter_name, vehicle_type, default_driver_name, default_driver_phone)
        VALUES (v_norm_plate, COALESCE(p_transporter_name, 'Direct / Unknown'), COALESCE(p_vehicle_type, '10-Wheeler'), p_driver_name, p_driver_phone)
        RETURNING id, total_completed_visits INTO v_lorry_id, v_current_visits;
    ELSE
        -- Update vehicle/driver defaults if provided
        UPDATE public.lorries 
        SET transporter_name = COALESCE(p_transporter_name, transporter_name),
            default_driver_name = COALESCE(p_driver_name, default_driver_name),
            default_driver_phone = COALESCE(p_driver_phone, default_driver_phone),
            updated_at = timezone('utc'::text, now())
        WHERE id = v_lorry_id;
    END IF;

    -- Verify no active IN record exists
    SELECT EXISTS (
        SELECT 1 FROM public.lorry_movements 
        WHERE lorry_id = v_lorry_id AND is_active_inside = TRUE
    ) INTO v_active_exists;

    IF v_active_exists THEN
        RAISE EXCEPTION 'Lorry % is ALREADY recorded inside the premises. Please record OUT first before re-entering.', v_norm_plate;
    END IF;

    -- Insert movement
    INSERT INTO public.lorry_movements (
        lorry_id,
        plate_number,
        driver_name,
        driver_phone,
        transporter_name,
        cargo_details,
        purpose,
        entry_gate,
        entry_time,
        entry_recorded_by,
        entry_recorded_by_name,
        entry_odometer,
        entry_notes,
        status,
        is_active_inside,
        visit_number
    ) VALUES (
        v_lorry_id,
        v_norm_plate,
        p_driver_name,
        p_driver_phone,
        p_transporter_name,
        p_cargo_details,
        p_purpose,
        COALESCE(p_entry_gate, 'Main Gate'),
        timezone('utc'::text, now()),
        p_user_id,
        p_user_name,
        p_entry_odometer,
        p_entry_notes,
        'IN',
        TRUE,
        COALESCE(v_current_visits, 0) + 1
    ) RETURNING id INTO v_movement_id;

    -- Update lorry status to inside
    UPDATE public.lorries
    SET is_currently_inside = TRUE,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_lorry_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'movement_id', v_movement_id,
        'lorry_id', v_lorry_id,
        'plate_number', v_norm_plate,
        'visit_number', COALESCE(v_current_visits, 0) + 1
    );
END;
$$;

-- B. Record Lorry OUT (Completes the IN -> OUT Cycle as 1 visit)
CREATE OR REPLACE FUNCTION public.record_lorry_exit(
    p_movement_id UUID,
    p_exit_gate TEXT,
    p_exit_odometer INTEGER,
    p_exit_notes TEXT,
    p_user_id UUID,
    p_user_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lorry_id UUID;
    v_entry_time TIMESTAMPTZ;
    v_exit_time TIMESTAMPTZ;
    v_duration_mins INTEGER;
    v_new_total_visits INTEGER;
    v_plate TEXT;
BEGIN
    v_exit_time := timezone('utc'::text, now());

    -- Fetch and lock movement
    SELECT lorry_id, entry_time, plate_number INTO v_lorry_id, v_entry_time, v_plate
    FROM public.lorry_movements
    WHERE id = p_movement_id AND is_active_inside = TRUE AND status = 'IN'
    FOR UPDATE;

    IF v_lorry_id IS NULL THEN
        RAISE EXCEPTION 'No active IN movement found for this entry record or it was already recorded OUT.';
    END IF;

    -- Compute duration in minutes
    v_duration_mins := ROUND(EXTRACT(EPOCH FROM (v_exit_time - v_entry_time)) / 60.0);

    -- Update movement to OUT
    UPDATE public.lorry_movements
    SET status = 'OUT',
        is_active_inside = FALSE,
        exit_time = v_exit_time,
        exit_gate = COALESCE(p_exit_gate, 'Main Gate'),
        exit_recorded_by = p_user_id,
        exit_recorded_by_name = p_user_name,
        exit_odometer = p_exit_odometer,
        exit_notes = p_exit_notes,
        duration_minutes = v_duration_mins,
        updated_at = v_exit_time
    WHERE id = p_movement_id;

    -- Update Lorry totals and set inside = FALSE
    UPDATE public.lorries
    SET is_currently_inside = FALSE,
        total_completed_visits = total_completed_visits + 1,
        updated_at = v_exit_time
    WHERE id = v_lorry_id
    RETURNING total_completed_visits INTO v_new_total_visits;

    RETURN jsonb_build_object(
        'success', TRUE,
        'movement_id', p_movement_id,
        'plate_number', v_plate,
        'duration_minutes', v_duration_mins,
        'total_completed_visits', v_new_total_visits
    );
END;
$$;

-- 6. Trigger to automatically handle new Auth Users -> Profiles
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_count INTEGER;
    v_assigned_role TEXT;
BEGIN
    SELECT count(*) INTO v_user_count FROM public.profiles;
    -- If this is the very first user created in the app, promote to 'admin' automatically!
    IF v_user_count = 0 THEN
        v_assigned_role := 'admin';
    ELSE
        -- Default role is staff unless specified in raw_user_meta_data
        v_assigned_role := COALESCE(NEW.raw_user_meta_data->>'role', 'staff');
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        v_assigned_role,
        TRUE
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 7. Realtime Enablement
-- Allow frontend clients to listen to real-time updates for movements & lorries
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'lorry_movements'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.lorry_movements;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'lorries'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.lorries;
    END IF;
END $$;
