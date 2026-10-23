-- ============================================================
-- Sicherheits-Fix: Rollen-Haertung (Privilege Escalation)
-- Im Supabase SQL-Editor ausfuehren.
--
-- Schliesst zwei Wege, ueber die sich ein normaler Nutzer selbst
-- zum Admin machen konnte:
--
--   1) handle_new_user() uebernahm die Rolle aus den vom Client
--      gelieferten Metadaten (raw_user_meta_data->>'role'). Wer den
--      oeffentlichen anon-Key kennt, konnte sich per signUp mit
--      {data:{role:'admin'}} direkt als Admin registrieren.
--
--   2) Die Policy "Eigenes Profil bearbeiten" erlaubt UPDATE auf die
--      eigene profiles-Zeile ohne Spalten-Einschraenkung. Ein Nutzer
--      konnte damit role='admin' in sein eigenes Profil schreiben.
--
-- Zusaetzlich im Supabase-Dashboard empfohlen:
--   Authentication -> Providers -> Email -> "Allow new users to sign up" = AUS
-- ============================================================

-- 1) Trigger-Funktion: Rolle NIE aus Client-Metadaten uebernehmen.
--    Neue Accounts bekommen immer 'member'. Admin wird nur manuell
--    per SQL vergeben (siehe unten).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.email,
    'member'
  );
  return new;
end;
$$;

-- 2) Guard-Trigger auf profiles: verhindert, dass jemand seine eigene
--    Rolle aendert. Erlaubt bleibt:
--      - der Server-Kontext (service_role, z. B. die Edge Function
--        admin-update-auth) -> auth.uid() ist dort NULL
--      - ein bereits existierender Admin, der Rollen verwaltet
--    Die Funktion laeuft als SECURITY DEFINER und umgeht damit RLS,
--    sodass die EXISTS-Pruefung nicht rekursiv blockiert.
create or replace function public.profiles_role_guard()
returns trigger language plpgsql security definer as $$
begin
  -- Rolle unveraendert -> immer erlaubt (normale Profil-Edits)
  if new.role is not distinct from old.role then
    return new;
  end if;
  -- Server-/Trusted-Kontext (service_role) -> erlaubt
  if auth.uid() is null then
    return new;
  end if;
  -- Aufrufer ist bereits Admin -> darf Rollen vergeben
  if exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    return new;
  end if;
  -- sonst: Rollenaenderung blockieren
  raise exception 'Die eigene Rolle darf nicht geaendert werden.';
end;
$$;

drop trigger if exists profiles_role_guard_trg on public.profiles;
create trigger profiles_role_guard_trg
  before update on public.profiles
  for each row execute procedure public.profiles_role_guard();

-- ------------------------------------------------------------
-- Falls durch die alte Luecke ungewollte Admins entstanden sind,
-- hier pruefen und ggf. zuruecksetzen:
--   select id, name, email, role from public.profiles where role = 'admin';
--   update public.profiles set role = 'member' where email = 'fremde@email.de';
--
-- Legitimen Admin (wieder) setzen:
--   update public.profiles set role = 'admin' where email = 'deine@email.de';
-- ------------------------------------------------------------
