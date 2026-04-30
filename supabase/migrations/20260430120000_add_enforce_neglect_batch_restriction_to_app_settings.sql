-- Migration: Add enforce_neglect_batch_restriction to app_settings
ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS enforce_neglect_batch_restriction BOOLEAN NOT NULL DEFAULT false;
