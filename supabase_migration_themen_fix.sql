-- ============================================================
-- Nachbesserung: verbleibende Zusammenführungen (case-insensitiv)
-- Ausführen im Supabase SQL-Editor
-- ============================================================

CREATE OR REPLACE FUNCTION _merge_csv_ci(val text, old_val text, new_val text)
RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(mapped, ', ' ORDER BY min_pos)
  FROM (
    SELECT
      CASE WHEN lower(trim(raw)) = lower(old_val) THEN new_val ELSE trim(raw) END AS mapped,
      min(pos) AS min_pos
    FROM unnest(string_to_array(val, ',')) WITH ORDINALITY AS t(raw, pos)
    GROUP BY CASE WHEN lower(trim(raw)) = lower(old_val) THEN new_val ELSE trim(raw) END
  ) sub
$$;

-- Thema-Feld
DO $$
DECLARE
  merges text[][] := ARRAY[
    ARRAY['Anbetung Des Vaters',  'Anbetung'],
    ARRAY['Anbetung des Vaters',  'Anbetung'],
    ARRAY['Lasst Uns Anbeten',    'Anbetung'],
    ARRAY['Lasst uns anbeten',    'Anbetung'],
    ARRAY['Sehnsucht Nach Gott',  'Sehnsucht'],
    ARRAY['Sehnsucht nach Gott',  'Sehnsucht'],
    ARRAY['Stille Vor Gott',      'Stille'],
    ARRAY['Stille vor Gott',      'Stille'],
    ARRAY['Stille Zeit',          'Stille'],
    ARRAY['Stille zeit',          'Stille']
  ];
  m text[];
BEGIN
  FOREACH m SLICE 1 IN ARRAY merges LOOP
    UPDATE songs
    SET thema = _merge_csv_ci(thema, m[1], m[2])
    WHERE lower(thema) LIKE '%' || lower(m[1]) || '%';
  END LOOP;
END $$;

-- Anlass-Feld
DO $$
DECLARE
  merges text[][] := ARRAY[
    ARRAY['Anbetung Des Vaters',  'Anbetung'],
    ARRAY['Anbetung des Vaters',  'Anbetung'],
    ARRAY['Lasst Uns Anbeten',    'Anbetung'],
    ARRAY['Lasst uns anbeten',    'Anbetung'],
    ARRAY['Sehnsucht Nach Gott',  'Sehnsucht'],
    ARRAY['Sehnsucht nach Gott',  'Sehnsucht'],
    ARRAY['Stille Vor Gott',      'Stille'],
    ARRAY['Stille vor Gott',      'Stille'],
    ARRAY['Stille Zeit',          'Stille'],
    ARRAY['Stille zeit',          'Stille']
  ];
  m text[];
BEGIN
  FOREACH m SLICE 1 IN ARRAY merges LOOP
    UPDATE songs
    SET anlass = _merge_csv_ci(anlass, m[1], m[2])
    WHERE lower(anlass) LIKE '%' || lower(m[1]) || '%';
  END LOOP;
END $$;

DROP FUNCTION _merge_csv_ci(text, text, text);
