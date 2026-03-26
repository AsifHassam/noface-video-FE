alter table if exists public.automation_script_queue
add column if not exists overlay_image_url text;

comment on column public.automation_script_queue.overlay_image_url is
'Optional per-script overlay image URL uploaded during queueing.';
