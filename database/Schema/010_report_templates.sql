-- Report templates persistence
-- Stores user-defined report definitions (source, columns, filters, sort, pageSize)

CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,

  source_key TEXT NOT NULL,
  columns JSONB NOT NULL DEFAULT '[]',      -- array of column names
  filters JSONB NOT NULL DEFAULT '[]',      -- array of { field, op, value, value2? }
  sort JSONB NOT NULL DEFAULT '[]',         -- array of { field, dir }
  page_size INT NOT NULL DEFAULT 25,
  joins JSONB NOT NULL DEFAULT '[]',        -- array of { relation, type, columns[] }

  visibility TEXT NOT NULL DEFAULT 'private', -- 'private' | 'shared' | 'global'
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_report_templates_owner ON report_templates(created_by, visibility);

-- RLS policy sketch (adjust to your conventions)
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;

-- Allow owners to manage their templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'report_templates' AND policyname = 'report_templates_select'
  ) THEN
    CREATE POLICY report_templates_select ON report_templates
      FOR SELECT USING (
        visibility = 'global' OR
        (visibility = 'shared') OR
        (auth.uid() = created_by)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'report_templates' AND policyname = 'report_templates_insert'
  ) THEN
    CREATE POLICY report_templates_insert ON report_templates
      FOR INSERT WITH CHECK (auth.uid() = created_by);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'report_templates' AND policyname = 'report_templates_update'
  ) THEN
    CREATE POLICY report_templates_update ON report_templates
      FOR UPDATE USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'report_templates' AND policyname = 'report_templates_delete'
  ) THEN
    CREATE POLICY report_templates_delete ON report_templates
      FOR DELETE USING (auth.uid() = created_by);
  END IF;
END $$;
