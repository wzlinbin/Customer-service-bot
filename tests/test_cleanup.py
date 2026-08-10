import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

import chat_router


class CleanupTests(unittest.TestCase):
    def test_cleanup_removes_only_expired_data(self):
        original_db_file = chat_router.DB_FILE
        with tempfile.TemporaryDirectory() as temp_dir:
            chat_router.DB_FILE = Path(temp_dir) / "chat.db"
            try:
                chat_router.init_chat_db()
                with closing(sqlite3.connect(chat_router.DB_FILE)) as conn, conn:
                    conn.execute(
                        """INSERT INTO chat_sessions
                           (session_id, nickname, created_at)
                           VALUES ('old', 'Old', datetime('now', '-48 hours'))"""
                    )
                    conn.execute(
                        """INSERT INTO chat_sessions
                           (session_id, nickname)
                           VALUES ('recent', 'Recent')"""
                    )
                    conn.execute(
                        """INSERT INTO chat_msgs
                           (session_id, direction, content, created_at)
                           VALUES ('old', 'in', 'expired',
                                   datetime('now', '-48 hours'))"""
                    )
                    conn.execute(
                        """INSERT INTO chat_msgs
                           (session_id, direction, content)
                           VALUES ('recent', 'in', 'active')"""
                    )

                deleted_sessions, deleted_messages = (
                    chat_router.cleanup_expired_data()
                )

                self.assertEqual((deleted_sessions, deleted_messages), (1, 1))
                with closing(sqlite3.connect(chat_router.DB_FILE)) as conn:
                    sessions = conn.execute(
                        "SELECT session_id FROM chat_sessions"
                    ).fetchall()
                    messages = conn.execute(
                        "SELECT content FROM chat_msgs"
                    ).fetchall()
                self.assertEqual(sessions, [("recent",)])
                self.assertEqual(messages, [("active",)])
            finally:
                chat_router.DB_FILE = original_db_file


if __name__ == "__main__":
    unittest.main()
