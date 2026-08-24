-- ============================================================
-- Migration: Themen & Anlässe zusammenführen
-- Ausführen im Supabase SQL-Editor (einmalig)
-- ============================================================

-- Hilfsfunktion: ersetzt einen Wert in einer kommaseparierten Liste
-- und entfernt Duplikate (entsteht, wenn beide Varianten in einem Lied stehen)
CREATE OR REPLACE FUNCTION _merge_csv_tag(val text, old_val text, new_val text)
RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(part, ', ')
  FROM (
    SELECT DISTINCT
      CASE WHEN trim(part) = old_val THEN new_val ELSE trim(part) END AS part,
      min(pos) AS pos  -- Originalreihenfolge erhalten
    FROM unnest(string_to_array(val, ',')) WITH ORDINALITY AS t(part, pos)
    GROUP BY CASE WHEN trim(part) = old_val THEN new_val ELSE trim(part) END
    ORDER BY min(pos)
  ) sub
$$;

-- ============================================================
-- THEMA-Feld: alle Zusammenführungen
-- ============================================================
DO $$
DECLARE
  merges text[][] := ARRAY[
    ARRAY['Leiden Christi',     'Passion'],
    ARRAY['Leiden Jesu',        'Passion'],
    ARRAY['Lob',                'Lob & Preis'],
    ARRAY['Lob und Preis',      'Lob & Preis'],
    ARRAY['Lobpreis',           'Lob & Preis'],
    ARRAY['Lasst Uns Anbeten',  'Anbetung'],
    ARRAY['Anbetung Des Vaters','Anbetung'],
    ARRAY['Glaube',             'Glaube & Vertrauen'],
    ARRAY['Vertrauen',          'Glaube & Vertrauen'],
    ARRAY['Das Erlösungswerk',  'Erlösung'],
    ARRAY['Erlösungswerk',      'Erlösung'],
    ARRAY['Frieden',            'Friede'],
    ARRAY['Wiederkunft',        'Wiederkunft Christi'],
    ARRAY['Evangelistisch',     'Evangelisation'],
    ARRAY['Sehnsucht Nach Gott','Sehnsucht'],
    ARRAY['Stille Vor Gott',    'Stille'],
    ARRAY['Stille Zeit',        'Stille'],
    ARRAY['Jahreswechsel',      'Neujahr'],
    ARRAY['Liebe & Vergebung',  'Vergebung'],
    ARRAY['Morgen',             'Morgenlied']
  ];
  m text[];
BEGIN
  FOREACH m SLICE 1 IN ARRAY merges LOOP
    UPDATE songs
    SET thema = _merge_csv_tag(thema, m[1], m[2])
    WHERE thema LIKE '%' || m[1] || '%';
  END LOOP;
END $$;

-- ============================================================
-- ANLASS-Feld: dieselben Zusammenführungen
-- ============================================================
DO $$
DECLARE
  merges text[][] := ARRAY[
    ARRAY['Leiden Christi',     'Passion'],
    ARRAY['Leiden Jesu',        'Passion'],
    ARRAY['Lob',                'Lob & Preis'],
    ARRAY['Lob und Preis',      'Lob & Preis'],
    ARRAY['Lobpreis',           'Lob & Preis'],
    ARRAY['Lasst Uns Anbeten',  'Anbetung'],
    ARRAY['Anbetung Des Vaters','Anbetung'],
    ARRAY['Glaube',             'Glaube & Vertrauen'],
    ARRAY['Vertrauen',          'Glaube & Vertrauen'],
    ARRAY['Das Erlösungswerk',  'Erlösung'],
    ARRAY['Erlösungswerk',      'Erlösung'],
    ARRAY['Frieden',            'Friede'],
    ARRAY['Wiederkunft',        'Wiederkunft Christi'],
    ARRAY['Evangelistisch',     'Evangelisation'],
    ARRAY['Sehnsucht Nach Gott','Sehnsucht'],
    ARRAY['Stille Vor Gott',    'Stille'],
    ARRAY['Stille Zeit',        'Stille'],
    ARRAY['Jahreswechsel',      'Neujahr'],
    ARRAY['Liebe & Vergebung',  'Vergebung'],
    ARRAY['Morgen',             'Morgenlied']
  ];
  m text[];
BEGIN
  FOREACH m SLICE 1 IN ARRAY merges LOOP
    UPDATE songs
    SET anlass = _merge_csv_tag(anlass, m[1], m[2])
    WHERE anlass LIKE '%' || m[1] || '%';
  END LOOP;
END $$;

-- Hilfsfunktion wieder entfernen
DROP FUNCTION _merge_csv_tag(text, text, text);

-- Ergebnis prüfen (optional):
-- SELECT id, title, thema, anlass FROM songs
-- WHERE thema LIKE '%Leiden%' OR thema LIKE '%Lobpreis%' OR anlass LIKE '%Leiden%';
