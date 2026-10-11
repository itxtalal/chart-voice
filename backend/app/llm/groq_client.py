"""Thin wrapper around the Groq API.

Model ids change over time: check https://console.groq.com/docs/models and
override them in .env (GROQ_TEXT_MODEL, GROQ_VISION_MODEL) without code edits.
"""

import json
import os
import time

from dotenv import load_dotenv

load_dotenv()

TEXT_MODEL = os.getenv("GROQ_TEXT_MODEL", "openai/gpt-oss-120b")
VISION_MODEL = os.getenv("GROQ_VISION_MODEL", "qwen/qwen3.8-27b")


class LLMError(Exception):
    """Groq is unreachable, not configured, or returned something unusable."""


def _client():
    key = os.getenv("GROQ_API_KEY")
    if not key:
        raise LLMError("GROQ_API_KEY is not set (offline mode)")
    from groq import Groq

    return Groq(api_key=key, timeout=20)


def _complete(messages: list[dict], model: str, temperature: float, max_tokens: int, json_mode: bool) -> str:
    client = _client()
    kwargs = {"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens}
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    attempts = 3
    for attempt in range(attempts):
        try:
            response = client.chat.completions.create(**kwargs)
            return response.choices[0].message.content or ""
        except Exception as exc:  # groq raises several error types; treat all as LLMError
            # Retry what is usually temporary: rate limits, dropped connections, timeouts, server errors.
            status = getattr(exc, "status_code", None)
            temporary = status == 429 or (status is not None and status >= 500) or type(exc).__name__ in (
                "APIConnectionError",
                "APITimeoutError",
            )
            if temporary and attempt < attempts - 1:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise LLMError(f"Groq request failed: {exc}") from exc
    raise LLMError("Groq request failed after retries")


def chat_json(messages: list[dict], model: str = TEXT_MODEL, temperature: float = 0.2, max_tokens: int = 800) -> dict:
    text = _complete(messages, model, temperature, max_tokens, json_mode=True)
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise LLMError("Groq returned invalid JSON") from exc
    if not isinstance(data, dict):
        raise LLMError("Groq returned JSON that is not an object")
    return data


def chat_text(messages: list[dict], model: str = TEXT_MODEL, temperature: float = 0.3, max_tokens: int = 600) -> str:
    return _complete(messages, model, temperature, max_tokens, json_mode=False).strip()
