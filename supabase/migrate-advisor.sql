-- ============================================================
-- SQL Migration Script
-- Renames advisor_3 to data_modeling atomically.
-- Run this in the Supabase SQL editor.
-- ============================================================

CREATE OR REPLACE FUNCTION public.migrate_advisor_to_data_modeling()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Ensure 'data_modeling' is upserted into model_config, copying from 'advisor_3' if it exists.
  INSERT INTO public.model_config (advisor_id, provider, model, updated_by, updated_at)
  SELECT 'data_modeling', provider, model, updated_by, updated_at
  FROM public.model_config
  WHERE advisor_id = 'advisor_3'
  ON CONFLICT (advisor_id) DO UPDATE
  SET
    provider = EXCLUDED.provider,
    model = EXCLUDED.model,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at;

  -- Ensure 'data_modeling' exists with defaults if 'advisor_3' was not present
  INSERT INTO public.model_config (advisor_id, provider, model)
  VALUES ('data_modeling', 'openai', 'gpt-4o')
  ON CONFLICT (advisor_id) DO NOTHING;

  -- 2. Update any existing conversations pointing to 'advisor_3' to 'data_modeling'
  UPDATE public.conversations
  SET advisor_id = 'data_modeling'
  WHERE advisor_id = 'advisor_3';

  -- 3. Delete the old 'advisor_3' row from model_config
  DELETE FROM public.model_config
  WHERE advisor_id = 'advisor_3';

  -- 4. Add the foreign key constraint on public.conversations(advisor_id) referencing public.model_config(advisor_id)
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'conversations_advisor_id_fkey'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_advisor_id_fkey
      FOREIGN KEY (advisor_id) REFERENCES public.model_config(advisor_id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;
