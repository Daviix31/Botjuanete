CREATE OR REPLACE FUNCTION noxis_json_merge(a jsonb,b jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
 SELECT COALESCE(jsonb_object_agg(COALESCE(x.key,y.key),CASE WHEN jsonb_typeof(x.value)='object' AND jsonb_typeof(y.value)='object' THEN noxis_json_merge(x.value,y.value) ELSE COALESCE(y.value,x.value) END),'{}'::jsonb)
 FROM jsonb_each(a) x FULL JOIN jsonb_each(b) y ON x.key=y.key;
$$;
ALTER TABLE scheduled_announcements DROP CONSTRAINT IF EXISTS scheduled_announcements_status_check;
ALTER TABLE scheduled_announcements ADD CONSTRAINT scheduled_announcements_status_check CHECK(status IN ('pending','processing','sent','failed','cancelled'));
ALTER TABLE scheduled_announcements ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE scheduled_announcements ADD COLUMN IF NOT EXISTS message_id text;
ALTER TABLE scheduled_announcements ADD COLUMN IF NOT EXISTS last_error text;
CREATE TABLE IF NOT EXISTS bot_jobs(id bigserial PRIMARY KEY,guild_id text NOT NULL,actor_id text NOT NULL,kind text NOT NULL,payload jsonb NOT NULL,request_key text NOT NULL,fingerprint text NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','succeeded','failed','needs_review')),result jsonb,error text,created_at timestamptz NOT NULL DEFAULT NOW(),started_at timestamptz,finished_at timestamptz,UNIQUE(guild_id,request_key));
CREATE INDEX IF NOT EXISTS idx_jobs_pending ON bot_jobs(guild_id,status,id);
CREATE TABLE IF NOT EXISTS bot_status(guild_id text PRIMARY KEY,snapshot jsonb NOT NULL,updated_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS web_sessions(id text PRIMARY KEY,user_id text NOT NULL,expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS announcement_templates(id bigserial PRIMARY KEY,guild_id text NOT NULL,name text NOT NULL,payload jsonb NOT NULL,created_by text NOT NULL,UNIQUE(guild_id,name));
CREATE TABLE IF NOT EXISTS tickets(id bigserial PRIMARY KEY,guild_id text NOT NULL,user_id text NOT NULL,channel_id text UNIQUE,status text NOT NULL DEFAULT 'creating' CHECK(status IN ('creating','open','closed','failed')),created_at timestamptz NOT NULL DEFAULT NOW(),closed_at timestamptz);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_active ON tickets(guild_id,user_id) WHERE status IN ('creating','open');
CREATE TABLE IF NOT EXISTS polls(id bigserial PRIMARY KEY,guild_id text NOT NULL,channel_id text NOT NULL,message_id text,question text NOT NULL,options jsonb NOT NULL,created_by text NOT NULL,status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),created_at timestamptz NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS poll_votes(poll_id bigint NOT NULL REFERENCES polls(id) ON DELETE CASCADE,user_id text NOT NULL,option_index int NOT NULL CHECK(option_index>=0 AND option_index<10),PRIMARY KEY(poll_id,user_id));
CREATE TABLE IF NOT EXISTS giveaways(id bigserial PRIMARY KEY,guild_id text NOT NULL,channel_id text NOT NULL,message_id text,prize text NOT NULL,created_by text NOT NULL,ends_at timestamptz NOT NULL,status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),winner_ids jsonb NOT NULL DEFAULT '[]',announced boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS giveaway_entries(giveaway_id bigint NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,user_id text NOT NULL,PRIMARY KEY(giveaway_id,user_id));
CREATE TABLE IF NOT EXISTS member_levels(guild_id text NOT NULL,user_id text NOT NULL,xp int NOT NULL DEFAULT 0 CHECK(xp>=0),messages int NOT NULL DEFAULT 0,last_awarded_at timestamptz NOT NULL DEFAULT NOW(),PRIMARY KEY(guild_id,user_id));
CREATE TABLE IF NOT EXISTS bot_leases(guild_id text PRIMARY KEY,instance_id text NOT NULL,expires_at timestamptz NOT NULL);
