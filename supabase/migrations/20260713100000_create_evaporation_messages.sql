-- Migration: Create evaporation_messages table for QC page
-- Description: Stores evaporation risk messages (high, moderate, low) for the admin QC page

-- Create evaporation_messages table
CREATE TABLE IF NOT EXISTS public.evaporation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level VARCHAR(20) NOT NULL UNIQUE,  -- 'high', 'moderate', 'low'
    tagline VARCHAR(255),
    title VARCHAR(255),
    subtitle VARCHAR(255),
    color VARCHAR(20),  -- Hex color like '#2f7ed8'
    message TEXT,       -- Message content/details
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on level for faster lookups
CREATE INDEX IF NOT EXISTS idx_evaporation_messages_level ON public.evaporation_messages(level);

-- Insert default data for the three risk levels
INSERT INTO public.evaporation_messages (level, tagline, title, subtitle, color, message)
VALUES
    ('high', 'Tagline', 'High Risk', 'Subtitle', '#2f7ed8', ''),
    ('moderate', 'Tagline', 'Moderate Risk', 'Subtitle', '#2f7ed8', ''),
    ('low', 'Tagline', 'Low Risk', 'Subtitle', '#2f7ed8', '')
ON CONFLICT (level) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE public.evaporation_messages ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Allow all for authenticated users" ON public.evaporation_messages
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create policy for service role (full access)
CREATE POLICY "Allow all for service role" ON public.evaporation_messages
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_evaporation_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_evaporation_messages_updated_at
    BEFORE UPDATE ON public.evaporation_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_evaporation_messages_updated_at();
