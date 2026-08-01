-- Minimal stand-ins for what Supabase provides, so migrations can be applied to
-- a plain Postgres in CI.
--
-- The migrations reference auth.uid() 127 times, auth.users 95 times,
-- auth.role() 11 times and storage.objects 3 times. None of that exists in a
-- stock Postgres image, so without these stubs every run would fail on the
-- environment rather than on anything the migrations got wrong.
--
-- These are deliberately the thinnest thing that lets DDL resolve. They are not
-- a Supabase emulation and must never be applied to a real database: RLS
-- policies compiled against these stubs would behave differently, because
-- auth.uid() here returns NULL rather than the caller's id.

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;

-- Supabase installs these into the `extensions` schema, and the dumped schema
-- calls them fully qualified as extensions.uuid_generate_v4(). Installing them
-- into public instead makes the baseline fail on a name that does resolve in
-- production.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto"  SCHEMA extensions;

-- Enough of auth.users for foreign keys to resolve. Real Supabase has far more
-- columns; migrations only reference id and email.
CREATE TABLE IF NOT EXISTS auth.users (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text
);

-- In production these read the request's JWT claims. Here they return NULL,
-- which is fine for CREATE POLICY (only the expression has to type-check) and
-- is why this must not touch a real database.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT NULL::text $$;

CREATE OR REPLACE FUNCTION auth.email() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT NULL::text $$;

-- storage.objects: three migrations attach policies to it.
CREATE TABLE IF NOT EXISTS storage.objects (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text,
  name     text,
  owner    uuid
);

CREATE TABLE IF NOT EXISTS storage.buckets (
  id   text PRIMARY KEY,
  name text
);

-- Roles the migrations GRANT to. CREATE ROLE is not idempotent, hence the guard.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
  -- The dump carries ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin, which
  -- requires membership in that role rather than just its existence.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin NOLOGIN;
  END IF;
END $$;

GRANT supabase_admin TO CURRENT_USER;

GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;

-- Supabase ships a realtime publication that migrations add tables to.
-- Without it, ALTER PUBLICATION fails on the environment rather than on
-- anything the migration got wrong.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;
