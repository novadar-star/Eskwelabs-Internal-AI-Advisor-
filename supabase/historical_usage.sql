-- ============================================================
-- get_historical_usage (RPC function)
--
-- Time-series aggregation for messages, tokens, spend, blocked, and error events.
-- Casts created_at timestamps to 'Asia/Manila' timezone before filtering and grouping.
--
-- Security:
--   - Defined with SECURITY DEFINER to bypass RLS policies during admin reports.
--   - Revokes EXECUTE from PUBLIC and grants EXECUTE only to service_role.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_historical_usage(
  p_range_days integer DEFAULT 30,
  p_advisor_id text DEFAULT 'all',
  p_group_by text DEFAULT 'day'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_date timestamptz;
  v_result json;
BEGIN
  -- Compute the start date in Asia/Manila timezone
  v_start_date := date_trunc('day', now() at time zone 'Asia/Manila') - (p_range_days || ' days')::interval;

  WITH filtered_messages AS (
    SELECT 
      m.id,
      m.user_id,
      m.conversation_id,
      m.role,
      m.status,
      m.prompt_tokens,
      m.completion_tokens,
      m.est_cost_usd,
      m.created_at,
      c.advisor_id,
      u.email
    FROM public.messages m
    JOIN public.conversations c ON m.conversation_id = c.id
    JOIN public.users u ON m.user_id = u.id
    WHERE m.created_at >= v_start_date
      AND (p_advisor_id = 'all' OR c.advisor_id = p_advisor_id)
  ),
  series_agg AS (
    SELECT
      CASE 
        WHEN p_group_by = 'week' THEN date_trunc('week', created_at at time zone 'Asia/Manila')::date::text
        ELSE (created_at at time zone 'Asia/Manila')::date::text
      END AS date_group,
      count(1) FILTER (WHERE role = 'user' AND status <> 'blocked') as messages_count,
      coalesce(sum(coalesce(prompt_tokens, 0) + coalesce(completion_tokens, 0)), 0) as tokens_count,
      coalesce(sum(coalesce(est_cost_usd, 0)), 0) as spend_count,
      count(1) FILTER (WHERE status = 'blocked') as blocked_count,
      count(1) FILTER (WHERE status = 'error') as errors_count
    FROM filtered_messages
    GROUP BY date_group
    ORDER BY date_group ASC
  ),
  totals_agg AS (
    SELECT
      count(1) FILTER (WHERE role = 'user' AND status <> 'blocked') as messages_total,
      coalesce(sum(coalesce(prompt_tokens, 0) + coalesce(completion_tokens, 0)), 0) as tokens_total,
      coalesce(sum(coalesce(est_cost_usd, 0)), 0) as spend_total,
      count(1) FILTER (WHERE status = 'blocked') as blocked_total,
      count(1) FILTER (WHERE status = 'error') as errors_total,
      count(distinct user_id) as unique_users_total
    FROM filtered_messages
  ),
  by_advisor_agg AS (
    SELECT
      advisor_id,
      count(1) FILTER (WHERE role = 'user' AND status <> 'blocked') as messages_count,
      coalesce(sum(coalesce(prompt_tokens, 0) + coalesce(completion_tokens, 0)), 0) as tokens_count,
      coalesce(sum(coalesce(est_cost_usd, 0)), 0) as spend_count
    FROM filtered_messages
    GROUP BY advisor_id
    ORDER BY spend_count DESC
  ),
  by_user_agg AS (
    SELECT
      email,
      count(1) FILTER (WHERE role = 'user' AND status <> 'blocked') as messages_count,
      coalesce(sum(coalesce(prompt_tokens, 0) + coalesce(completion_tokens, 0)), 0) as tokens_count,
      coalesce(sum(coalesce(est_cost_usd, 0)), 0) as spend_count
    FROM filtered_messages
    GROUP BY email
    ORDER BY spend_count DESC
  )
  SELECT json_build_object(
    'series', coalesce((SELECT json_agg(json_build_object(
      'date', date_group,
      'messages', messages_count,
      'tokens', tokens_count,
      'spend_usd', spend_count,
      'blocked', blocked_count,
      'errors', errors_count
    )) FROM series_agg), '[]'::json),
    'totals', (SELECT json_build_object(
      'messages', messages_total,
      'tokens', tokens_total,
      'spend_usd', spend_total,
      'blocked', blocked_total,
      'errors', errors_total,
      'unique_users', unique_users_total
    ) FROM totals_agg),
    'by_advisor', coalesce((SELECT json_agg(json_build_object(
      'advisor_id', advisor_id,
      'messages', messages_count,
      'tokens', tokens_count,
      'spend_usd', spend_count
    )) FROM by_advisor_agg), '[]'::json),
    'by_user', coalesce((SELECT json_agg(json_build_object(
      'email', email,
      'messages', messages_count,
      'tokens', tokens_count,
      'spend_usd', spend_count
    )) FROM by_user_agg), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Restrict function execution permissions to service_role only
REVOKE ALL ON FUNCTION public.get_historical_usage(integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_historical_usage(integer, text, text) TO service_role;

COMMENT ON FUNCTION public.get_historical_usage IS
  'Time-series aggregation for messages, tokens, and cost. Used by admin dashboard.';
