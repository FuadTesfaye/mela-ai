CREATE TABLE IF NOT EXISTS worker_state (name text PRIMARY KEY, value jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS channel_preferences (channel text NOT NULL, destination text NOT NULL, language text NOT NULL DEFAULT 'en', PRIMARY KEY(channel,destination));
CREATE TABLE IF NOT EXISTS channel_tickets (ticket_id uuid PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE, channel text NOT NULL, destination text NOT NULL, last_message_id bigint NOT NULL DEFAULT 0);
