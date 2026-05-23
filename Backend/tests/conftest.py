"""Shared fixtures for the Backend Lambda tests.

We use `moto` to mock S3 and DynamoDB in-memory so tests run without any
network calls. The OpenAI client is patched per-test via monkeypatch so we
never hit the real API.

Each Lambda module is called `lambda_function` (AWS convention) so we cannot
import them by name without a collision. We load each one by file path with
a unique module alias (`lens_<name>`) and a fresh import each test so the
module-level boto3 clients pick up moto.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType
from typing import Any

import boto3
import pytest
from moto import mock_aws

BACKEND_DIR = Path(__file__).resolve().parent.parent


def load_lambda(name: str) -> ModuleType:
    """Import Backend/<name>/lambda_function.py under a unique alias."""
    alias = f"lens_{name.lower()}"
    sys.modules.pop(alias, None)
    spec = importlib.util.spec_from_file_location(
        alias, BACKEND_DIR / name / "lambda_function.py"
    )
    assert spec and spec.loader, f"Could not load {name}"
    module = importlib.util.module_from_spec(spec)
    sys.modules[alias] = module
    spec.loader.exec_module(module)
    return module


SESSIONS_TABLE_NAME = "LensSessionsTest"
CHUNKS_TABLE_NAME = "LensChunksTest"
BUCKET_NAME = "lens-test-bucket"


@pytest.fixture(autouse=True)
def aws_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Boto3 needs *some* credentials and a region even when talking to moto."""
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "test")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "test")
    monkeypatch.setenv("AWS_SESSION_TOKEN", "test")
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")


@pytest.fixture(autouse=True)
def lambda_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Lambda env vars are read at module-import time, so we always set them."""
    monkeypatch.setenv("BUCKET_NAME", BUCKET_NAME)
    monkeypatch.setenv("TABLE_NAME", SESSIONS_TABLE_NAME)
    monkeypatch.setenv("SESSIONS_TABLE", SESSIONS_TABLE_NAME)
    monkeypatch.setenv("CHUNKS_TABLE", CHUNKS_TABLE_NAME)


@pytest.fixture
def aws():
    """Start moto and create the S3 bucket + DynamoDB tables Lens expects."""
    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket=BUCKET_NAME)

        ddb = boto3.resource("dynamodb", region_name="us-east-1")
        sessions = ddb.create_table(
            TableName=SESSIONS_TABLE_NAME,
            KeySchema=[{"AttributeName": "sessionId", "KeyType": "HASH"}],
            AttributeDefinitions=[
                {"AttributeName": "sessionId", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        chunks = ddb.create_table(
            TableName=CHUNKS_TABLE_NAME,
            KeySchema=[
                {"AttributeName": "sessionId", "KeyType": "HASH"},
                {"AttributeName": "chunkId", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "sessionId", "AttributeType": "S"},
                {"AttributeName": "chunkId", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        sessions.wait_until_exists()
        chunks.wait_until_exists()
        yield {"s3": s3, "sessions": sessions, "chunks": chunks}


class FakeEmbeddings:
    """Minimal stand-in for openai.embeddings."""

    def __init__(self, vector: list[float]) -> None:
        self._vector = vector

    def create(self, *_args: Any, **_kwargs: Any) -> Any:
        class _Resp:
            data = [type("D", (), {"embedding": self._vector})()]
        return _Resp()


class FakeChatCompletions:
    def __init__(self, content: str) -> None:
        self._content = content

    def create(self, *_args: Any, **_kwargs: Any) -> Any:
        message = type("Msg", (), {"content": self._content})()
        choice = type("Choice", (), {"message": message})()
        return type("Resp", (), {"choices": [choice]})()


class FakeOpenAI:
    def __init__(self, embedding: list[float], chat_content: str = "fake answer") -> None:
        self.embeddings = FakeEmbeddings(embedding)
        self.chat = type("Chat", (), {"completions": FakeChatCompletions(chat_content)})()


@pytest.fixture
def fake_openai() -> FakeOpenAI:
    return FakeOpenAI(embedding=[0.1, 0.2, 0.3], chat_content="fake answer")
