-- Fix created_by constraint to allow NULL values
-- This fixes the contradiction between NOT NULL and ON DELETE SET NULL

ALTER TABLE pois ALTER COLUMN created_by DROP NOT NULL;
