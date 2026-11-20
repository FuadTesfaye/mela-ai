ALTER TABLE sections DROP CONSTRAINT IF EXISTS sections_language_check;
ALTER TABLE sections ADD CONSTRAINT sections_language_check CHECK (language IN ('en','am','om','ti'));
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_language_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_language_check CHECK (language IN ('en','am','om','ti'));
-- Application data is served by authorised Next.js routes, not anonymous Data API clients.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sections','tickets','tutor_messages','jobs','subscriptions','alert_deliveries','share_sessions','share_signals','webhooks','webhook_deliveries','worker_state','channel_preferences','channel_tickets','signing_tracks','schema_migrations'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM anon', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated', t);
    END IF;
  END LOOP;
END $$;
