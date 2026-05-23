"""Tests for the LlamaStatus Lambda."""

from __future__ import annotations

import json

from tests.conftest import load_lambda


def _put_session(aws, **fields):
    item = {"sessionId": "abc123", "status": "PROCESSING"}
    item.update(fields)
    aws["sessions"].put_item(Item=item)


def test_returns_session_status(aws):
    _put_session(aws, status="READY_FOR_QUERY")
    module = load_lambda("LlamaStatus")
    event = {"pathParameters": {"sessionId": "abc123"}}

    result = module.lambda_handler(event, None)

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert body == {"sessionId": "abc123", "status": "READY_FOR_QUERY"}


def test_returns_error_field_when_present(aws):
    _put_session(aws, status="ERROR", error="parse blew up")
    module = load_lambda("LlamaStatus")
    event = {"pathParameters": {"sessionId": "abc123"}}

    body = json.loads(module.lambda_handler(event, None)["body"])
    assert body["status"] == "ERROR"
    assert body["error"] == "parse blew up"


def test_404_when_session_missing(aws):
    module = load_lambda("LlamaStatus")
    event = {"pathParameters": {"sessionId": "nope"}}
    result = module.lambda_handler(event, None)
    assert result["statusCode"] == 404


def test_400_when_sessionId_missing(aws):
    module = load_lambda("LlamaStatus")
    result = module.lambda_handler({}, None)
    assert result["statusCode"] == 400


def test_accepts_session_id_from_query_string(aws):
    _put_session(aws, status="PROCESSING")
    module = load_lambda("LlamaStatus")
    event = {"queryStringParameters": {"sessionId": "abc123"}}
    result = module.lambda_handler(event, None)
    assert result["statusCode"] == 200
