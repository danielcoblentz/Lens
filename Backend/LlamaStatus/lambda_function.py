"""LlamaStatus: read the current status of a session.

GET /sessions/{sessionId} — used by the frontend to poll parse progress
instead of guessing how long LlamaParse will take.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

SESSIONS_TABLE = os.environ["SESSIONS_TABLE"]
sessions_table = boto3.resource("dynamodb").Table(SESSIONS_TABLE)

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
}


def _response(status_code: int, body: dict[str, Any]) -> dict[str, Any]:
    return {"statusCode": status_code, "headers": CORS_HEADERS, "body": json.dumps(body)}


def _extract_session_id(event: dict[str, Any]) -> str | None:
    """Pull the sessionId from API Gateway v1 or v2 event shapes."""
    path_params = event.get("pathParameters") or {}
    session_id = path_params.get("sessionId")
    if session_id:
        return session_id

    query = event.get("queryStringParameters") or {}
    return query.get("sessionId")


def lambda_handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    session_id = _extract_session_id(event)
    if not session_id:
        return _response(400, {"error": "sessionId is required"})

    item = sessions_table.get_item(Key={"sessionId": session_id}).get("Item")
    if not item:
        return _response(404, {"error": "Session not found"})

    body: dict[str, Any] = {
        "sessionId": session_id,
        "status": item.get("status", "UNKNOWN"),
    }
    if "error" in item:
        body["error"] = item["error"]

    return _response(200, body)
