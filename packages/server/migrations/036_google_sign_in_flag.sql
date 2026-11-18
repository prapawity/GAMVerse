ALTER TABLE app_platform_feature_flags DROP CONSTRAINT IF EXISTS app_platform_feature_flags_feature_key_check;
ALTER TABLE app_platform_feature_flags ADD CONSTRAINT app_platform_feature_flags_feature_key_check
  CHECK (feature_key IN ('map_editing', 'prop_editing', 'google_sign_in'));
INSERT INTO app_platform_feature_flags(feature_key, enabled) VALUES ('google_sign_in', false)
ON CONFLICT (feature_key) DO NOTHING;
