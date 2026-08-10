import unittest
from pathlib import Path

from settings import PROJECT_DIR, load_settings


class SettingsTests(unittest.TestCase):
    def test_loads_values_and_resolves_relative_database_path(self):
        loaded = load_settings(
            {
                "TG_BOT_TOKEN": " token ",
                "TG_ADMIN_ID": " 12345 ",
                "CHAT_API_KEY": " secret ",
                "CHAT_ALLOWED_ORIGINS": (
                    "https://api.api2cn.com, http://localhost:3000"
                ),
                "CHAT_DB_FILE": "data/test-chat.db",
                "APP_PORT": "9000",
                "CHAT_DATA_RETENTION_HOURS": "12.5",
            }
        )

        self.assertTrue(loaded.telegram_enabled)
        self.assertEqual(loaded.tg_bot_token, "token")
        self.assertEqual(loaded.tg_admin_id, "12345")
        self.assertEqual(loaded.chat_api_key, "secret")
        self.assertEqual(loaded.app_port, 9000)
        self.assertEqual(loaded.data_retention_hours, 12.5)
        self.assertEqual(
            loaded.allowed_origins,
            ("https://api.api2cn.com", "http://localhost:3000"),
        )
        self.assertEqual(
            loaded.db_file,
            (PROJECT_DIR / Path("data/test-chat.db")).resolve(),
        )

    def test_rejects_invalid_port(self):
        with self.assertRaisesRegex(ValueError, "APP_PORT"):
            load_settings({"APP_PORT": "70000"})

    def test_telegram_is_disabled_when_configuration_is_incomplete(self):
        loaded = load_settings({"TG_BOT_TOKEN": "token"})

        self.assertFalse(loaded.telegram_enabled)


if __name__ == "__main__":
    unittest.main()
