-- Agents & related supportive tables for future lead management
-- Run after core academic & fee schemas (depends only on touch_updated_at function existing)

-- Core agents table
CREATE TABLE IF NOT EXISTS agents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id       integer UNIQUE,              -- from legacy agentsid
  name            text NOT NULL,
  email_raw       text,                        -- original email as imported
  email           text,                        -- lowercased trimmed for lookups
  phone_raw       text,                        -- original phone string
  phone_e164      text,                        -- normalized digits with +CC when derivable
  status          smallint NOT NULL DEFAULT 1 CHECK (status IN (0,1)), -- 1=active 0=inactive
  source_channel  text,                        -- later: referral|aggregator|internal|other
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid
);

CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_email ON agents(email);
CREATE INDEX IF NOT EXISTS idx_agents_phone_e164 ON agents(phone_e164);

-- Contact points (allows multiple phones/emails/messaging IDs)
CREATE TABLE IF NOT EXISTS agent_contacts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id       uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  contact_type   text NOT NULL CHECK (contact_type IN ('email','phone','whatsapp','telegram','other')),
  value_raw      text,
  value_norm     text,            -- normalized (lowercased email / digits phone)
  is_primary     boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid,
  UNIQUE(agent_id, contact_type, value_norm)
);
CREATE INDEX IF NOT EXISTS idx_agent_contacts_type ON agent_contacts(contact_type);

-- Lightweight tag table for segmentation (optional extension usage later)
CREATE TABLE IF NOT EXISTS agent_tags (
  agent_id   uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  tag        text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(agent_id, tag)
);

-- Notes table for internal remarks / interactions
CREATE TABLE IF NOT EXISTS agent_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id   uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  remarks       text NOT NULL,
  is_paid     boolean NOT NULL DEFAULT false, 
  student_id  uuid REFERENCES students(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid 
);

-- Updated_at triggers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_agents_touch') THEN
    CREATE TRIGGER trg_agents_touch BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_agent_contacts_touch') THEN
    CREATE TRIGGER trg_agent_contacts_touch BEFORE UPDATE ON agent_contacts
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;

-- Future (not created yet): lead entities will reference agents.id as owner / source.

