-- Shared fixed-window counters. Deploy this migration before the application.
CREATE TABLE public.request_rate_limits (
    bucket_key text PRIMARY KEY CHECK (bucket_key ~ '^[a-f0-9]{64}$'),
    hits integer NOT NULL CHECK (hits > 0),
    expires_at timestamptz NOT NULL
);
CREATE INDEX request_rate_limits_expiry_idx ON public.request_rate_limits (expires_at);
ALTER TABLE public.request_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.request_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_rate_limits TO service_role;

CREATE FUNCTION public.consume_rate_limit(bucket_key text, request_limit integer, window_ms integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
SET statement_timeout = '5s'
AS $$
DECLARE
    limiter_now timestamptz := clock_timestamp();
    counter public.request_rate_limits%ROWTYPE;
BEGIN
    IF bucket_key IS NULL OR bucket_key !~ '^[a-f0-9]{64}$'
       OR request_limit IS NULL OR request_limit < 1 OR request_limit > 10000
       OR window_ms IS NULL OR window_ms < 1000 OR window_ms > 86400000 THEN
        RAISE EXCEPTION 'Invalid rate-limit parameters' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.request_rate_limits AS existing (bucket_key, hits, expires_at)
    VALUES (bucket_key, 1, limiter_now + window_ms * interval '1 millisecond')
    ON CONFLICT ON CONSTRAINT request_rate_limits_pkey DO UPDATE SET
        hits = CASE WHEN existing.expires_at <= limiter_now THEN 1
                    ELSE least(existing.hits + 1, request_limit + 1) END,
        expires_at = CASE WHEN existing.expires_at <= limiter_now
                          THEN limiter_now + window_ms * interval '1 millisecond'
                          ELSE existing.expires_at END
    RETURNING * INTO counter;

    -- Bound cleanup work and skip rows locked by other requests.
    DELETE FROM public.request_rate_limits AS stale WHERE stale.bucket_key IN (
        SELECT expired.bucket_key FROM public.request_rate_limits AS expired
        WHERE expired.expires_at < limiter_now AND expired.bucket_key <> consume_rate_limit.bucket_key
        ORDER BY expired.expires_at LIMIT 100 FOR UPDATE SKIP LOCKED
    );

    RETURN jsonb_build_object(
        'success', counter.hits <= request_limit,
        'remaining', greatest(0, request_limit - counter.hits),
        'reset', floor(extract(epoch FROM counter.expires_at) * 1000)::bigint
    );
END;
$$;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO service_role;
