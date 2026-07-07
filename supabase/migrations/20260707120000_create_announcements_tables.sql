-- Migration: Create announcements tables
-- Created: 2026-07-07
-- Description: Creates tables for announcement form functionality

-- Drop function first (this will also drop the trigger)
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Drop tables in correct order (if they exist)
DROP TABLE IF EXISTS announcement_screens;
DROP TABLE IF EXISTS announcement_organizations;
DROP TABLE IF EXISTS announcements;
DROP TABLE IF EXISTS campaigns;
DROP TABLE IF EXISTS organizations;
DROP TABLE IF EXISTS screens;

-- ============================================
-- 1. Create campaigns table
-- ============================================
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE campaigns IS 'Campaign types for announcements (General, Maintenance, etc.)';

-- ============================================
-- 2. Create organizations table
-- ============================================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE organizations IS 'Company divisions that can see announcements';

-- ============================================
-- 3. Create screens table
-- ============================================
CREATE TABLE screens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE screens IS 'Screens where announcements can be displayed';

-- ============================================
-- 4. Create announcements table
-- ============================================
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Basic Info
    name VARCHAR(255) NOT NULL,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,

    -- Date Range
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    -- Tile Display Settings
    tile_type VARCHAR(50) NOT NULL DEFAULT '3x1Icon',
    tagline VARCHAR(255),
    title VARCHAR(255),
    subtitle VARCHAR(255),
    icon_or_percent VARCHAR(500),
    color VARCHAR(50),

    -- Publishing
    is_published BOOLEAN DEFAULT FALSE,

    -- Message Content
    message_details TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

COMMENT ON TABLE announcements IS 'Main announcements/tiles data';
COMMENT ON COLUMN announcements.tile_type IS '3x1Icon (with image) or 3x1Pie (with pie chart)';
COMMENT ON COLUMN announcements.icon_or_percent IS 'URL for icon image or percentage value for pie chart';
COMMENT ON COLUMN announcements.color IS 'Hex color code for tile background (e.g., RED, #FF0000)';

-- ============================================
-- 5. Create junction table: announcements <-> organizations
-- ============================================
CREATE TABLE announcement_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(announcement_id, organization_id)
);

COMMENT ON TABLE announcement_organizations IS 'Which organizations can see which announcements';

-- ============================================
-- 6. Create junction table: announcements <-> screens
-- ============================================
CREATE TABLE announcement_screens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    screen_id UUID NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(announcement_id, screen_id)
);

COMMENT ON TABLE announcement_screens IS 'Which screens show which announcements';

-- ============================================
-- 7. Create indexes for better query performance
-- ============================================
CREATE INDEX idx_announcements_published ON announcements(is_published);
CREATE INDEX idx_announcements_dates ON announcements(start_date, end_date);
CREATE INDEX idx_announcements_campaign ON announcements(campaign_id);
CREATE INDEX idx_announcement_orgs_announcement ON announcement_organizations(announcement_id);
CREATE INDEX idx_announcement_orgs_org ON announcement_organizations(organization_id);
CREATE INDEX idx_announcement_screens_announcement ON announcement_screens(announcement_id);
CREATE INDEX idx_announcement_screens_screen ON announcement_screens(screen_id);

-- ============================================
-- 8. Insert default campaigns
-- ============================================
INSERT INTO campaigns (name, description) VALUES
    ('GENERAL', 'GENERAL COMPANY NEWS'),
    ('MAINTENANCE', 'MESSAGES INDICATING SYSTEM ISSUES OR PLANNED MAINTENANCE'),
    ('TRUCKAST ANNOUNCEMENTS', '');

-- ============================================
-- 9. Insert default organizations
-- ============================================
INSERT INTO organizations (name, code) VALUES
    ('DOLESE', 'dolese'),
    ('EASTERN', 'eastern'),
    ('NORTHERN', 'northern'),
    ('OKC METRO', 'okc-metro'),
    ('SOUTHEASTERN', 'southeastern'),
    ('SOUTHWESTERN', 'southwestern'),
    ('TULSA', 'tulsa'),
    ('WESTERN', 'western'),
    ('PIEDMONT', 'piedmont');

-- ============================================
-- 10. Insert default screens
-- ============================================
INSERT INTO screens (name, code) VALUES
    ('ORDER REQUEST DETAILS', 'order-request-details'),
    ('MARKETS', 'markets'),
    ('JOBS', 'jobs');

-- ============================================
-- 11. Enable Row Level Security (RLS)
-- ============================================
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_screens ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 12. Create RLS Policies
-- ============================================
CREATE POLICY "Allow all on announcements" ON announcements FOR ALL USING (true);
CREATE POLICY "Allow all on campaigns" ON campaigns FOR ALL USING (true);
CREATE POLICY "Allow all on organizations" ON organizations FOR ALL USING (true);
CREATE POLICY "Allow all on screens" ON screens FOR ALL USING (true);
CREATE POLICY "Allow all on announcement_organizations" ON announcement_organizations FOR ALL USING (true);
CREATE POLICY "Allow all on announcement_screens" ON announcement_screens FOR ALL USING (true);

-- ============================================
-- 13. Create auto-update trigger for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_announcements_updated_at
    BEFORE UPDATE ON announcements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
