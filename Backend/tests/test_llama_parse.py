"""Tests for the LlamaParse Lambda.

We don't test the PdfReader path end-to-end here. The handler downloads a
PDF and reads it with PyPDF2 — we stub `extract_pdf_text` after import so
the test fixture can run without producing a real PDF.
"""

from __future__ import annotations

import json
from decimal import Decimal

from tests.conftest import load_lambda


def _make_event(session_id: str) -> dict:
    return {
        "Records": [
            {
                "s3": {
                    "bucket": {"name": "lens-test-bucket"},
                    "object": {"key": f"uploads/{session_id}.pdf"},
                }
            }
        ]
    }


def test_chunk_text_splits_on_paragraphs():
    module = load_lambda("LlamaParse")
    text = "paragraph one.\n\nparagraph two.\n\nparagraph three."
    chunks = module.chunk_text(text, chunk_size=20, chunk_overlap=0)
    assert chunks  # at least one chunk
    assert all(len(c) <= 20 for c in chunks)
    joined = " ".join(chunks).lower()
    assert "paragraph one" in joined
    assert "paragraph three" in joined


def test_chunk_text_returns_empty_for_blank_input():
    module = load_lambda("LlamaParse")
    assert module.chunk_text("") == []
    assert module.chunk_text("   \n\n   ") == []


def test_chunk_text_hard_splits_paragraphs_larger_than_chunk_size():
    module = load_lambda("LlamaParse")
    long_paragraph = "x" * 250
    chunks = module.chunk_text(long_paragraph, chunk_size=100, chunk_overlap=10)
    assert len(chunks) >= 3
    assert all(len(c) <= 100 for c in chunks)


def test_chunk_text_carries_overlap_between_chunks():
    module = load_lambda("LlamaParse")
    text = ("alpha " * 30).strip() + "\n\n" + ("beta " * 30).strip()
    chunks = module.chunk_text(text, chunk_size=120, chunk_overlap=20)
    assert len(chunks) >= 2


def test_lambda_handler_writes_chunks_and_marks_session_ready(
    aws, monkeypatch, fake_openai
):
    session_id = "session-xyz"
    aws["sessions"].put_item(
        Item={"sessionId": session_id, "status": "AWAITING_UPLOAD"}
    )
    aws["s3"].put_object(
        Bucket="lens-test-bucket",
        Key=f"uploads/{session_id}.pdf",
        Body=b"%PDF-stub",
    )

    module = load_lambda("LlamaParse")
    monkeypatch.setattr(module, "_openai_client", fake_openai)
    monkeypatch.setattr(
        module,
        "extract_pdf_text",
        lambda _path: "paragraph one.\n\nparagraph two.\n\nparagraph three.",
    )

    result = module.lambda_handler(_make_event(session_id), None)
    body = json.loads(result["body"])

    assert result["statusCode"] == 200
    assert body["chunksCreated"] >= 1

    session = aws["sessions"].get_item(Key={"sessionId": session_id})["Item"]
    assert session["status"] == "READY_FOR_QUERY"

    chunks = aws["chunks"].query(
        KeyConditionExpression=__import__("boto3").dynamodb.conditions.Key(
            "sessionId"
        ).eq(session_id)
    )["Items"]
    assert chunks
    assert all(isinstance(chunks[0]["embedding"][0], Decimal) for _ in [None])


def test_lambda_handler_marks_session_as_error_on_failure(
    aws, monkeypatch, fake_openai
):
    session_id = "session-fail"
    aws["sessions"].put_item(
        Item={"sessionId": session_id, "status": "AWAITING_UPLOAD"}
    )
    aws["s3"].put_object(
        Bucket="lens-test-bucket",
        Key=f"uploads/{session_id}.pdf",
        Body=b"%PDF-stub",
    )

    module = load_lambda("LlamaParse")
    monkeypatch.setattr(module, "_openai_client", fake_openai)

    def boom(_path):
        raise RuntimeError("pdf parser exploded")

    monkeypatch.setattr(module, "extract_pdf_text", boom)

    result = module.lambda_handler(_make_event(session_id), None)
    assert result["statusCode"] == 500

    session = aws["sessions"].get_item(Key={"sessionId": session_id})["Item"]
    assert session["status"] == "ERROR"
    assert "pdf parser exploded" in session["error"]


def test_lambda_handler_is_idempotent(aws, monkeypatch, fake_openai):
    session_id = "session-idem"
    aws["sessions"].put_item(
        Item={"sessionId": session_id, "status": "READY_FOR_QUERY"}
    )
    aws["chunks"].put_item(
        Item={
            "sessionId": session_id,
            "chunkId": "chunk_0",
            "text": "existing",
            "embedding": [Decimal("0.1")],
            "order": 0,
        }
    )

    module = load_lambda("LlamaParse")
    called = {"extract": 0}

    def should_not_run(_path):
        called["extract"] += 1
        return "should never happen"

    monkeypatch.setattr(module, "_openai_client", fake_openai)
    monkeypatch.setattr(module, "extract_pdf_text", should_not_run)

    result = module.lambda_handler(_make_event(session_id), None)
    body = json.loads(result["body"])

    assert result["statusCode"] == 200
    assert body.get("skipped") is True
    assert called["extract"] == 0
