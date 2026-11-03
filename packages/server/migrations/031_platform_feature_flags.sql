CREATE TABLE IF NOT EXISTS app_platform_feature_flags (
  feature_key text PRIMARY KEY CHECK (feature_key IN ('map_editing', 'prop_editing')),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app_platform_feature_flags(feature_key, enabled) VALUES
  ('map_editing', true), ('prop_editing', true)
ON CONFLICT (feature_key) DO NOTHING;
