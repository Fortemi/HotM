import os
from typing import Optional, Dict, Any
import httpx

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_MODEL = os.environ.get("OLLAMA_MODEL", "mistral")
DEFAULT_EMBED_MODEL = os.environ.get("OLLAMA_EMBED_MODEL", "nomic-embed-text")


class OllamaClient:
    def __init__(self, base_url: str = OLLAMA_BASE_URL, model: str = DEFAULT_MODEL):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self._client = httpx.Client(timeout=60.0)

    def generate(self, prompt: str, model: Optional[str] = None, options: Optional[Dict[str, Any]] = None) -> str:
        payload = {
            "model": model or self.model,
            "prompt": prompt,
            "stream": False,
        }
        if options:
            payload["options"] = options
        resp = self._client.post(f"{self.base_url}/api/generate", json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data.get("response", "")

    def embed(self, text: str, model: Optional[str] = None) -> Optional[list[float]]:
        payload = {
            "model": model or DEFAULT_EMBED_MODEL,
            "input": text,
        }
        resp = self._client.post(f"{self.base_url}/api/embeddings", json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data.get("embedding")
