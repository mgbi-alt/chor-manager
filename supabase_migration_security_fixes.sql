-- Sicherheits-Fix: song_performance_stats umging RLS (jeder konnte ohne
-- Login alle Zeilen lesen, weil die View mit Owner-Rechten lief statt
-- mit den Rechten des Aufrufers).
-- Ausführen im Supabase SQL-Editor.

create or replace view public.song_performance_stats
with (security_invoker = true) as
select
  s.id as song_id,
  s.title,
  s.besetzung,
  s.komponist,
  count(ep.id) as total_performances,
  max(e.datum) as last_performed,
  min(e.datum) as first_performed,
  array_agg(e.datum order by e.datum desc) filter (where e.datum is not null) as performance_dates,
  array_agg(e.title order by e.datum desc) filter (where e.datum is not null) as event_titles
from songs s
left join event_program ep on ep.song_id = s.id
left join events e on e.id = ep.event_id
group by s.id, s.title, s.besetzung, s.komponist;
