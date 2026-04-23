-- Sourcing chat memory (Track A): versioned thesis context + per-user threads

CREATE TABLE IF NOT EXISTS public.ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_sub TEXT NOT NULL,
    title TEXT,
    conversation_summary TEXT,
    nivo_context_version TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_ai_conversations_user_updated
    ON public.ai_conversations (user_sub, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_ai_messages_conversation_created
    ON public.ai_messages (conversation_id, created_at);

COMMENT ON TABLE public.ai_conversations IS 'AI sourcing chat threads; user_sub is Auth0 sub when authenticated';
COMMENT ON TABLE public.ai_messages IS 'Turns for sourcing chat; content is user text or assistant reply text';
