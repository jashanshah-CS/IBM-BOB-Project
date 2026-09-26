from typing import Any

import requests


class TestForgeError(RuntimeError):
    """Raised when the TypeScript backend cannot fulfil a request."""


class TestForgeClient:
    def __init__(self, base_url: str, timeout: float = 30.0):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def _request(self, method: str, path: str, **kwargs: Any) -> dict:
        try:
            response = requests.request(
                method, f"{self.base_url}{path}", timeout=self.timeout, **kwargs
            )
        except requests.RequestException as error:
            raise TestForgeError(
                f"Cannot connect to the TypeScript backend at {self.base_url}."
            ) from error

        try:
            payload = response.json()
        except ValueError as error:
            raise TestForgeError(
                f"The backend returned an invalid response (HTTP {response.status_code})."
            ) from error
        if not response.ok:
            detail = payload.get("error", response.reason) if isinstance(payload, dict) else response.reason
            raise TestForgeError(f"TestForge request failed: {detail}")
        return payload

    def health(self) -> dict:
        return self._request("GET", "/health")

    def analyse(self, code: str) -> dict:
        return self._request("POST", "/playground/analyse", json={"code": code})

    def run(self, code: str) -> dict:
        return self._request("POST", "/playground/run", json={"code": code})

    def generate(self, code: str) -> dict:
        return self._request("POST", "/playground/generate", json={"code": code})

