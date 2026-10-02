-- Familia modelada como grafo: person = nos, relationship = arestas tipadas.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE tree (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE person (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id     UUID         NOT NULL REFERENCES tree (id) ON DELETE CASCADE,
    full_name   VARCHAR(200) NOT NULL CHECK (length(btrim(full_name)) > 0),
    -- nome normalizado (minusculo, sem acento) preenchido pela aplicacao, usado na busca
    search_name VARCHAR(200) NOT NULL,
    gender      VARCHAR(20)  CHECK (gender IN ('MALE', 'FEMALE', 'OTHER')),
    photo_key   VARCHAR(500),
    notes       TEXT,
    attributes  JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_person_tree ON person (tree_id);
CREATE INDEX idx_person_search_name_trgm ON person USING gin (search_name gin_trgm_ops);

CREATE TABLE relationship (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id        UUID        NOT NULL REFERENCES tree (id) ON DELETE CASCADE,
    type           VARCHAR(20) NOT NULL CHECK (type IN ('PARENT_OF', 'PARTNER')),
    -- PARENT_OF: from = pai/mae, to = filho(a). PARTNER: nao dirigida, from < to.
    from_person_id UUID        NOT NULL REFERENCES person (id) ON DELETE CASCADE,
    to_person_id   UUID        NOT NULL REFERENCES person (id) ON DELETE CASCADE,
    subtype        VARCHAR(20),
    kind           VARCHAR(20),
    attributes     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_relationship UNIQUE (type, from_person_id, to_person_id),
    CONSTRAINT ck_no_self CHECK (from_person_id <> to_person_id),
    CONSTRAINT ck_partner_canonical CHECK (type <> 'PARTNER' OR from_person_id < to_person_id),
    CONSTRAINT ck_parent_subtype CHECK (type <> 'PARENT_OF' OR coalesce(subtype IN ('FATHER', 'MOTHER', 'PARENT'), false)),
    CONSTRAINT ck_parent_kind CHECK (type <> 'PARENT_OF'
        OR coalesce(kind IN ('BIOLOGICAL', 'ADOPTIVE', 'STEP', 'FOSTER', 'UNKNOWN'), false)),
    CONSTRAINT ck_partner_subtype CHECK (type <> 'PARTNER' OR coalesce(subtype IN ('MARRIED', 'PARTNERS', 'EX'), false))
);

CREATE INDEX idx_relationship_from ON relationship (from_person_id);
CREATE INDEX idx_relationship_to ON relationship (to_person_id);
CREATE INDEX idx_relationship_tree_type ON relationship (tree_id, type);

-- Arvore padrao do MVP (uma so por enquanto).
INSERT INTO tree (name) VALUES ('Minha familia');
