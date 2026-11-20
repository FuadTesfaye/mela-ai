CREATE TABLE IF NOT EXISTS telegram_updates (
 id bigint PRIMARY KEY,
 destination text NOT NULL,
 text text NOT NULL,
 reply text,
 attempts integer NOT NULL DEFAULT 0,
 lease_until timestamptz,
 completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE telegram_updates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON telegram_updates FROM anon; END IF;
IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON telegram_updates FROM authenticated; END IF;
END $$;
