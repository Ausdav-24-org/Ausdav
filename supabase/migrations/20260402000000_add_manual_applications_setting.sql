-- Add column to allow admins to toggle manual applicant submissions
alter table public.app_settings
add column if not exists allow_manual_applications boolean not null default false;

-- Initialize the setting
update public.app_settings
set allow_manual_applications = false
where id = 1;
