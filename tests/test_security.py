import unittest

import httpx

import main


class SecurityTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.original_api_key = main.chat_api_key
        self.transport = httpx.ASGITransport(app=main.app)
        self.client = httpx.AsyncClient(
            transport=self.transport,
            base_url="http://test",
        )

    async def asyncTearDown(self):
        main.chat_api_key = self.original_api_key
        await self.client.aclose()

    async def test_public_pages_are_disabled(self):
        for path in ("/", "/docs", "/redoc", "/openapi.json"):
            response = await self.client.get(path)
            self.assertEqual(response.status_code, 404, path)

    async def test_protected_routes_fail_closed_without_configuration(self):
        main.chat_api_key = ""

        response = await self.client.get("/static/chat-widget.js")

        self.assertEqual(response.status_code, 503)

    async def test_protected_routes_reject_wrong_key(self):
        main.chat_api_key = "expected-secret"

        response = await self.client.get(
            "/static/chat-widget.js",
            headers={"X-API-Key": "wrong-secret"},
        )

        self.assertEqual(response.status_code, 401)

    async def test_protected_routes_accept_correct_key(self):
        main.chat_api_key = "expected-secret"

        response = await self.client.get(
            "/static/chat-widget.js",
            headers={"X-API-Key": "expected-secret"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("api2cn-chat-widget", response.text)

    async def test_cors_allows_production_and_local_origins_only(self):
        cases = {
            "https://api.api2cn.com": 200,
            "http://localhost:5173": 200,
            "http://127.0.0.1:3000": 200,
            "https://other.api2cn.com": 400,
            "https://api2cn.com.evil.example": 400,
        }

        for origin, expected_status in cases.items():
            with self.subTest(origin=origin):
                response = await self.client.options(
                    "/api/chat/login",
                    headers={
                        "Origin": origin,
                        "Access-Control-Request-Method": "POST",
                        "Access-Control-Request-Headers": "content-type",
                    },
                )
                self.assertEqual(response.status_code, expected_status)
                if expected_status == 200:
                    self.assertEqual(
                        response.headers.get("access-control-allow-origin"),
                        origin,
                    )
                else:
                    self.assertNotIn(
                        "access-control-allow-origin",
                        response.headers,
                    )


if __name__ == "__main__":
    unittest.main()
