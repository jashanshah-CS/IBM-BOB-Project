import unittest
from unittest.mock import Mock, patch

import requests

from backend_client import TestForgeClient as BackendClient
from backend_client import TestForgeError as BackendError


def response(payload: dict, status: int = 200) -> Mock:
    result = Mock()
    result.ok = status < 400
    result.status_code = status
    result.reason = "Bad Request" if status >= 400 else "OK"
    result.json.return_value = payload
    return result


class BackendClientTests(unittest.TestCase):
    @patch("backend_client.requests.request")
    def test_run_sends_code_to_typescript_backend(self, request: Mock) -> None:
        request.return_value = response({"status": "verified", "passed": 4, "failed": 0})
        client = BackendClient("http://localhost:3000/")
        result = client.run("export function valid() { return true; }")
        self.assertEqual(result["status"], "verified")
        request.assert_called_once_with(
            "POST",
            "http://localhost:3000/playground/run",
            timeout=30.0,
            json={"code": "export function valid() { return true; }"},
        )

    @patch("backend_client.requests.request")
    def test_backend_error_is_explained(self, request: Mock) -> None:
        request.return_value = response({"error": "No code provided"}, 400)
        with self.assertRaisesRegex(BackendError, "No code provided"):
            BackendClient("http://localhost:3000").analyse("")

    @patch("backend_client.requests.request")
    def test_connection_error_is_explained(self, request: Mock) -> None:
        request.side_effect = requests.ConnectionError("offline")
        with self.assertRaisesRegex(BackendError, "Cannot connect"):
            BackendClient("http://localhost:3000").health()


if __name__ == "__main__":
    unittest.main()
