ALTER TABLE app_user_character_models
  DROP CONSTRAINT app_user_character_models_size,
  ADD CONSTRAINT app_user_character_models_size CHECK (octet_length(model) BETWEEN 1 AND 15728640);
