-- Migration: Seed announcements from D3 system
-- Created: 2026-07-07
-- Description: Adds existing announcements from D3

-- Insert announcements
INSERT INTO announcements (name, start_date, end_date, tile_type, tagline, title, subtitle, is_published, message_details) VALUES
('NEW!!! ORDERS IN REVIEW STATUS ARE BLUE', '2026-01-01', '2026-12-31', '3x1Icon', 'NEW', 'ORDERS IN REVIEW', 'STATUS ARE BLUE', true, 'Orders that are in review status will now be displayed in blue color.'),
('COVID-19', '2026-01-01', '2026-12-31', '3x1Icon', 'ALERT', 'COVID-19', 'INFORMATION', false, 'COVID-19 related information and updates.'),
('WELCOME TO TRUCKAST MOBILE APP', '2026-01-01', '2026-12-31', '3x1Icon', 'WELCOME', 'TRUCKAST', 'MOBILE APP', false, 'Welcome to the Truckast Mobile App!'),
('TECHNICAL ISSUE', '2026-01-01', '2026-12-31', '3x1Icon', 'ALERT', 'TECHNICAL', 'ISSUE', false, 'We are experiencing technical issues.'),
('TECHNICAL ISSUE RESOLVED', '2026-01-01', '2026-12-31', '3x1Icon', 'RESOLVED', 'TECHNICAL ISSUE', 'RESOLVED', false, 'Technical issues have been resolved.'),
('MONITORING UPDATES', '2026-01-01', '2026-12-31', '3x1Icon', 'INFO', 'MONITORING', 'UPDATES', true, 'System monitoring updates.'),
('FUEL SURCHARGES', '2026-01-01', '2026-12-31', '3x1Icon', 'PRICING', 'FUEL', 'SURCHARGES', true, 'Current fuel surcharge information.'),
('NEW FEATURE – ORDER CONCRETE', '2026-01-01', '2026-12-31', '3x1Icon', 'NEW', 'ORDER CONCRETE', 'FEATURE', false, 'New feature to order concrete online.');
