-- YouTube API policy: stored API data must be refreshed or deleted within 30 days.
-- Schedule the purge daily when pg_cron is available (enable it in Dashboard > Database > Extensions).
-- If it is not available the migration still succeeds; see README for the manual alternative.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('vuebox-purge-youtube-snapshots', '17 3 * * *', 'select public.purge_stale_youtube_snapshots()');
  else
    raise notice 'pg_cron is not available: schedule public.purge_stale_youtube_snapshots() manually (see README).';
  end if;
exception
  when others then
    raise notice 'could not schedule snapshot purge (%): schedule it manually (see README).', sqlerrm;
end;
$$;
