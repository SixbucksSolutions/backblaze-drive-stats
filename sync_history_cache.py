"""Copy a verified private cache manifest between local disk and owner Backblaze B2."""

import argparse
import json
import os
from pathlib import Path
from urllib.parse import urlsplit

from history_storage import B2ObjectStore, LocalObjectStore, transfer_verified


def owner_cache_client(endpoint: str, region: str):
    url = urlsplit(endpoint)
    if (
        url.scheme != "https"
        or url.hostname != f"s3.{region}.backblazeb2.com"
        or url.username
        or url.password
        or url.query
        or url.fragment
        or url.path not in {"", "/"}
        or url.port not in {None, 443}
    ):
        raise ValueError("Use the owner's HTTPS Backblaze B2 S3 endpoint and matching region")
    key = os.environ.get("B2_CACHE_ACCESS_KEY_ID")
    secret = os.environ.get("B2_CACHE_SECRET_ACCESS_KEY")
    if not key or not secret:
        raise ValueError(
            "Dedicated B2_CACHE_ACCESS_KEY_ID and B2_CACHE_SECRET_ACCESS_KEY are required"
        )
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=region,
        aws_access_key_id=key,
        aws_secret_access_key=secret,
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("direction", choices=("push", "pull"))
    parser.add_argument("--local-root", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--bucket", required=True)
    parser.add_argument("--prefix", required=True)
    parser.add_argument("--endpoint", required=True)
    parser.add_argument("--region", required=True)
    args = parser.parse_args()
    # Validate bucket/prefix before constructing a remote client.
    remote = B2ObjectStore(None, args.bucket, args.prefix)
    remote.client = owner_cache_client(args.endpoint, args.region)
    local = LocalObjectStore(args.local_root)
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    result = (
        transfer_verified(local, remote, manifest)
        if args.direction == "push"
        else transfer_verified(remote, local, manifest)
    )
    print(json.dumps(result))


if __name__ == "__main__":
    try:
        main()
    except ValueError, OSError:
        raise SystemExit(
            "Cache transfer failed; no completion receipt. Check private configuration and retry the same manifest."
        ) from None
