CREATE TABLE IF NOT EXISTS chat_sessions (
    session_id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_msgs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
    content TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    telegram_update_id INTEGER UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_msgs_session_id_id
    ON chat_msgs (session_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_chat_msgs_created_at
    ON chat_msgs (created_at);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at
    ON chat_sessions (created_at);
