import json
import boto3
import uuid
import os
from datetime import datetime

# imports
s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")

BUCKET_NAME = os.environ["BUCKET_NAME"]
TABLE_NAME = os.environ["TABLE_NAME"]
table = dynamodb.Table(TABLE_NAME)

def lambda_handler(event, context):
    #  create session ID
    session_id = str(uuid.uuid4())

    #  define where the file will be stored in S3
    object_key = f"uploads/{session_id}.pdf"

    #  generate presigned upload URL
    upload_url = s3.generate_presigned_url(
        ClientMethod="put_object",
        Params={
            "Bucket": BUCKET_NAME,
            "Key": object_key,
            "ContentType": "application/pdf"
        },
        ExpiresIn=3600
    )

    #  write initial session record to DynamoDB
    table.put_item(
        Item={
            "sessionId": session_id,
            "status": "AWAITING_UPLOAD",
            "createdAt": datetime.utcnow().isoformat(),
            "s3Key": object_key
        }
    )

    #  return sessionId ands upload URL to frontend
    return {
        "statusCode": 200,
        "headers": { "Content-Type": "application/json" },
        "body": json.dumps({
            "sessionId": session_id,
            "uploadUrl": upload_url
        })
    }
