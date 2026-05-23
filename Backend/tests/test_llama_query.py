"""Tests for the LlamaQuery Lambda."""

from __future__ import annotations

import json
import math
from decimal import Decimal

import pytest

from tests.conftest import FakeOpenAI, load_lambda


def _seed_session(aws, session_id: str = "s1", status: str = "READY_FOR_QUERY"):
    aws["sessions"].put_item(Item={"sessionId": session_id, "status": status})


def _seed_chunks(aws, session_id: str, embeddings: list[list[float]]):
    for i, embedding in enumerate(embeddings):
        aws["chunks"].put_item(
            Item={
                "sessionId": session_id,
                "chunkId": f"chunk_{i}",
                "text": f"text-{i}",
                "embedding": [Decimal(str(v)) for v in embedding],
                "order": i,
            }
        )


def test_cosine_similarity_identical_vectors():
    module = load_lambda("LlamaQuery")
    assert module.cosine_similarity([1.0, 0.0], [1.0, 0.0]) == pytest.approx(1.0)


def test_cosine_similarity_orthogonal_vectors():
    module = load_lambda("LlamaQuery")
    assert module.cosine_similarity([1.0, 0.0], [0.0, 1.0]) == pytest.approx(0.0)


def test_cosine_similarity_zero_vector_safe():
    module = load_lambda("LlamaQuery")
    assert module.cosine_similarity([0.0, 0.0], [1.0, 1.0]) == 0.0


def test_rank_chunks_returns_top_k_in_order():
    module = load_lambda("LlamaQuery")
    chunks = [
        {"text": "exact", "embedding": [Decimal("1"), Decimal("0")]},
        {"text": "orthogonal", "embedding": [Decimal("0"), Decimal("1")]},
        {"text": "close", "embedding": [Decimal("0.9"), Decimal("0.1")]},
    ]
    ranked = module.rank_chunks([1.0, 0.0], chunks, top_k=2)
    assert [text for _, text in ranked] == ["exact", "close"]


def test_rank_chunks_skips_chunks_without_embedding():
    module = load_lambda("LlamaQuery")
    chunks = [
        {"text": "one", "embedding": [Decimal("1")]},
        {"text": "no embedding"},
    ]
    ranked = module.rank_chunks([1.0], chunks, top_k=5)
    assert len(ranked) == 1


def test_handler_returns_400_on_invalid_json(aws):
    module = load_lambda("LlamaQuery")
    result = module.lambda_handler({"body": "{not json"}, None)
    assert result["statusCode"] == 400


def test_handler_returns_400_when_required_fields_missing(aws):
    module = load_lambda("LlamaQuery")
    result = module.lambda_handler(
        {"body": json.dumps({"sessionId": "s1"})}, None
    )
    assert result["statusCode"] == 400


def test_handler_returns_404_when_session_missing(aws):
    module = load_lambda("LlamaQuery")
    result = module.lambda_handler(
        {"body": json.dumps({"sessionId": "missing", "query": "x"})}, None
    )
    assert result["statusCode"] == 404


def test_handler_returns_409_when_session_not_ready(aws):
    _seed_session(aws, status="PROCESSING")
    module = load_lambda("LlamaQuery")
    result = module.lambda_handler(
        {"body": json.dumps({"sessionId": "s1", "query": "x"})}, None
    )
    assert result["statusCode"] == 409


def test_handler_happy_path(aws, monkeypatch):
    _seed_session(aws)
    _seed_chunks(aws, "s1", embeddings=[[1.0, 0.0], [0.0, 1.0]])

    module = load_lambda("LlamaQuery")
    monkeypatch.setattr(
        module,
        "_openai_client",
        FakeOpenAI(embedding=[1.0, 0.0], chat_content="the clause says X"),
    )

    result = module.lambda_handler(
        {"body": json.dumps({"sessionId": "s1", "query": "what does it say?"})},
        None,
    )

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert body["answer"] == "the clause says X"
    assert body["sessionId"] == "s1"
    assert body["metrics"]["chunks_searched"] == 2
    assert body["metrics"]["top_chunk_similarity"] == pytest.approx(1.0, rel=1e-3)


def test_handler_respects_custom_top_k(aws, monkeypatch):
    _seed_session(aws)
    _seed_chunks(aws, "s1", embeddings=[[1.0, 0.0], [0.9, 0.1], [0.0, 1.0]])

    module = load_lambda("LlamaQuery")
    fake = FakeOpenAI(embedding=[1.0, 0.0])
    monkeypatch.setattr(module, "_openai_client", fake)

    captured: dict[str, str] = {}
    original_build = module.build_prompt

    def spy(top_chunks, question):
        captured["count"] = str(len(top_chunks))
        return original_build(top_chunks, question)

    monkeypatch.setattr(module, "build_prompt", spy)

    module.lambda_handler(
        {"body": json.dumps({"sessionId": "s1", "query": "x", "topK": 1})}, None
    )
    assert captured["count"] == "1"
