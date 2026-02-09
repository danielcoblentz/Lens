import json
import boto3
import uuid
import os
from datetime import datetime

# aws service clients
s3_client = boto3.client("s3")
dynamodb_resource = boto3.resource("dynamodb")

# environment variables
pdf_upload_bucket = os.environ["BUCKET_NAME"]
sessions_table_name = os.environ["TABLE_NAME"]
sessions_table = dynamodb_resource.Table(sessions_table_name)


def lambda_handler(event, context):
    # create a unique session id for this upload
    new_session_id = str(uuid.uuid4())

    # define the s3 path where the pdf will be stored
    s3_object_key = f"uploads/{new_session_id}.pdf"

    # generate a presigned url that allows the frontend to upload directly to s3
    presigned_upload_url = s3_client.generate_presigned_url(
        ClientMethod="put_object",
        Params={
            "Bucket": pdf_upload_bucket,
            "Key": s3_object_key,
            "ContentType": "application/pdf"
        },
        ExpiresIn=3600  # url expires in 1 hour
    )

    # create initial session record in dynamodb
    # status will be updated by llamaParse after processing
    sessions_table.put_item(
        Item={
            "sessionId": new_session_id,
            "status": "AWAITING_UPLOAD",
            "createdAt": datetime.utcnow().isoformat(),
            "s3Key": s3_object_key
        }
    )

    # return the session id and upload url to the frontend
    response_body = {
        "sessionId": new_session_id,
        "uploadUrl": presigned_upload_url
    }

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "POST, OPTIONS"
        },
        "body": json.dumps(response_body)
    }
