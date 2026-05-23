"""Tests for the LlamaGet Lambda."""

from __future__ import annotations

import json

from tests.conftest import load_lambda


def test_returns_presigned_url_and_creates_session(aws):
    module = load_lambda("LlamaGet")
    result = module.lambda_handler({}, None)

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert body["sessionId"]
    assert body["uploadUrl"].startswith("https://")
    assert "lens-test-bucket" in body["uploadUrl"]

    item = aws["sessions"].get_item(Key={"sessionId": body["sessionId"]})["Item"]
    assert item["status"] == "AWAITING_UPLOAD"
    assert item["s3Key"] == f"uploads/{body['sessionId']}.pdf"


def test_includes_cors_headers(aws):
    module = load_lambda("LlamaGet")
    result = module.lambda_handler({}, None)
    assert result["headers"]["Access-Control-Allow-Origin"] == "*"


def test_each_call_creates_a_new_session(aws):
    module = load_lambda("LlamaGet")
    a = json.loads(module.lambda_handler({}, None)["body"])
    b = json.loads(module.lambda_handler({}, None)["body"])
    assert a["sessionId"] != b["sessionId"]
