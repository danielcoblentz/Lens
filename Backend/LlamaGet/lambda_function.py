"""LlamaGet: open a session and return a presigned S3 PUT URL.

Frontend calls this first. The PDF is then uploaded directly to S3 using
the URL we hand back, which is what triggers LlamaParse via an S3
ObjectCreated event.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

BUCKET_NAME = os.environ["BUCKET_NAME"]
SESSIONS_TABLE = os.environ["TABLE_NAME"]
PRESIGN_EXPIRES_SECONDS = int(os.environ.get("PRESIGN_EXPIRES_SECONDS", "3600"))

s3 = boto3.client("s3")
sessions_table = boto3.resource("dynamodb").Table(SESSIONS_TABLE)

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
}


def _response(status_code: int, body: dict[str, Any]) -> dict[str, Any]:
    return {"statusCode": status_code, "headers": CORS_HEADERS, "body": json.dumps(body)}


def lambda_handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    session_id = str(uuid.uuid4())
    s3_key = f"uploads/{session_id}.pdf"

    upload_url = s3.generate_presigned_url(
        ClientMethod="put_object",
        Params={
            "Bucket": BUCKET_NAME,
            "Key": s3_key,
            "ContentType": "application/pdf",
        },
        ExpiresIn=PRESIGN_EXPIRES_SECONDS,
    )

    sessions_table.put_item(
        Item={
            "sessionId": session_id,
            "status": "AWAITING_UPLOAD",
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "s3Key": s3_key,
        }
    )

    logger.info("opened session %s", session_id)
    return _response(200, {"sessionId": session_id, "uploadUrl": upload_url})
