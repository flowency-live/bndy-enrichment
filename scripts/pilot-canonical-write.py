#!/usr/bin/env python3
"""Canonical-write pilot runbook. See docs/PILOT-CANONICAL-WRITE-PACKET.md.

Every step is explicit and reversible. Run one step at a time:

  python scripts/pilot-canonical-write.py status
  python scripts/pilot-canonical-write.py arm      --keys onthecase:gig:131396,onthecase:gig:126222,...
  python scripts/pilot-canonical-write.py open     --run-id onthecase-pilot-2026-09-05-v1
  python scripts/pilot-canonical-write.py send     --run-id onthecase-pilot-2026-09-05-v1
  python scripts/pilot-canonical-write.py watch    --run-id onthecase-pilot-2026-09-05-v1
  python scripts/pilot-canonical-write.py close
  python scripts/pilot-canonical-write.py disarm

`close` and `disarm` are safe to run at any time and are the stop action.
"""

import argparse
import json
import sys
import time
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key

REGION = "eu-west-2"
TABLE = "BndyEnrichmentStack-StateTable9728C7E5-14HR6N3NEWGLM"
QUEUE = "https://sqs.eu-west-2.amazonaws.com/771551874768/BndyEnrichmentStack-SourceScanQueue1C378650-2ik6EDD7UUyd"
SOURCE_ID = "onthecase-gig-index"
SOURCE_URL = "https://onthecasemusic.co.uk/gigs"
CANDIDATE_PREFIX = f"event:{SOURCE_ID}:"

ddb = boto3.resource("dynamodb", region_name=REGION).Table(TABLE)
sqs = boto3.client("sqs", region_name=REGION)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def config():
    return ddb.get_item(Key={"pk": f"SOURCE#{SOURCE_ID}", "sk": "CONFIG"})["Item"]


def control():
    return ddb.get_item(Key={"pk": "CONTROL#PROJECTION", "sk": "GLOBAL"}, ConsistentRead=True).get("Item")


def status() -> None:
    cfg = config()
    ctl = control()
    policy = cfg.get("projectionPolicy") or {}
    print(json.dumps({
        "source": {
            "shadow": cfg.get("shadow"),
            "writerAuthority": cfg.get("writerAuthority"),
            "mode": policy.get("mode"),
            "entityCreation": policy.get("entityCreation"),
            "allowedActions": policy.get("allowedActions"),
            "pilotCandidateKeys": policy.get("pilotCandidateKeys"),
        },
        "control": ctl or "absent (writes off by default)",
    }, indent=2, default=str))


def arm(keys: list[str]) -> None:
    cfg = config()
    policy = dict(cfg.get("projectionPolicy") or {})
    for required, expected in (("mode", "additive-only"), ("entityCreation", "match-only")):
        if policy.get(required) != expected:
            sys.exit(f"refusing to arm: projectionPolicy.{required} is {policy.get(required)!r}, expected {expected!r}")
    if list(policy.get("allowedActions") or []) != ["create"]:
        sys.exit("refusing to arm: allowedActions must be exactly ['create']")
    full = [k if k.startswith(CANDIDATE_PREFIX) else CANDIDATE_PREFIX + k for k in keys]
    if not 1 <= len(full) <= 10:
        sys.exit("refusing to arm: the pilot allows 1 to 10 candidates")
    policy["pilotCandidateKeys"] = full
    ddb.update_item(
        Key={"pk": f"SOURCE#{SOURCE_ID}", "sk": "CONFIG"},
        UpdateExpression="SET shadow = :off, writerAuthority = :aws, projectionPolicy = :policy, pilotArmedAt = :at",
        ExpressionAttributeValues={":off": False, ":aws": "aws", ":policy": policy, ":at": now_iso()},
    )
    print("armed", SOURCE_ID, "with", len(full), "candidates. Global control is still OFF.")


def disarm() -> None:
    cfg = config()
    policy = dict(cfg.get("projectionPolicy") or {})
    policy.pop("pilotCandidateKeys", None)
    ddb.update_item(
        Key={"pk": f"SOURCE#{SOURCE_ID}", "sk": "CONFIG"},
        UpdateExpression="SET shadow = :on, writerAuthority = :cowork, projectionPolicy = :policy, pilotDisarmedAt = :at",
        ExpressionAttributeValues={":on": True, ":cowork": "cowork", ":policy": policy, ":at": now_iso()},
    )
    print("disarmed", SOURCE_ID, ": shadow=true, writerAuthority=cowork, allowlist removed")


def open_window(run_id: str) -> None:
    cfg = config()
    if cfg.get("shadow") is not False or cfg.get("writerAuthority") != "aws":
        sys.exit("refusing to open: arm the source first")
    if not (cfg.get("projectionPolicy") or {}).get("pilotCandidateKeys"):
        sys.exit("refusing to open: no pilotCandidateKeys on the source")
    ddb.put_item(Item={
        "pk": "CONTROL#PROJECTION", "sk": "GLOBAL",
        "canonicalWritesEnabled": True, "updatedAt": now_iso(), "pilotRunId": run_id,
    })
    print("global control ON for", run_id, "at", now_iso(), ". Close it within 30 minutes.")


def close_window() -> None:
    ddb.put_item(Item={
        "pk": "CONTROL#PROJECTION", "sk": "GLOBAL",
        "canonicalWritesEnabled": False, "updatedAt": now_iso(),
    })
    print("global control OFF (explicit) at", now_iso())


def send(run_id: str) -> None:
    ctl = control()
    if not ctl or ctl.get("canonicalWritesEnabled") is not True:
        sys.exit("refusing to send: global control is not on")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    body = {
        "sourceId": SOURCE_ID,
        "reason": "manual",
        "requestedAt": now_iso(),
        "reconciliationId": run_id,
        "taskKey": f"root:manual:{SOURCE_ID}:{stamp}",
        "task": {"kind": "gig-index", "url": SOURCE_URL, "fanoutMode": "none", "projectionBootstrap": True},
    }
    out = sqs.send_message(QueueUrl=QUEUE, MessageBody=json.dumps(body))
    print("sent", out["MessageId"], json.dumps(body))


def watch(run_id: str, timeout_s: int = 900) -> None:
    deadline = time.time() + timeout_s
    observation = None
    while time.time() < deadline and not observation:
        state = ddb.get_item(Key={"pk": f"SOURCE#{SOURCE_ID}", "sk": "STATE"})["Item"]
        if (state.get("metadata") or {}).get("lastReconciliationId") == run_id:
            observation = state["lastObservationId"]
        else:
            time.sleep(10)
    if not observation:
        sys.exit("run not recorded within timeout")
    print("observation", observation)
    meta = None
    while time.time() < deadline:
        item = ddb.get_item(Key={"pk": f"PROJECTION_RUN#{observation}", "sk": "META"}).get("Item")
        if item and int(item["counts"]["itemsSeen"]) >= int(item["expectedItems"]):
            meta = item
            break
        time.sleep(10)
    if not meta:
        sys.exit("projection did not complete within timeout; CLOSE THE WINDOW NOW")
    counts = {k: int(v) for k, v in meta["counts"].items()}
    print("projection", meta["status"], json.dumps(counts))
    rows = ddb.query(KeyConditionExpression=Key("pk").eq(f"PROJECTION_RUN#{observation}") & Key("sk").begins_with("ITEM#"))["Items"]
    keys = [r["idempotencyKey"] for r in rows]
    created, exceptions, shadow, failed = [], [], 0, 0
    client = boto3.client("dynamodb", region_name=REGION)
    from boto3.dynamodb.types import TypeDeserializer
    des = TypeDeserializer()
    for i in range(0, len(keys), 100):
        resp = client.batch_get_item(RequestItems={TABLE: {
            "Keys": [{"pk": {"S": f"PROJECTION_ITEM#{k}"}, "sk": {"S": "META"}} for k in keys[i:i + 100]],
            "ProjectionExpression": "#s,candidateKey,details.outcome,details.reason,details.candidate.artistName,details.candidate.venueName,details.candidate.#d",
            "ExpressionAttributeNames": {"#s": "status", "#d": "date"},
        }})
        for raw in resp["Responses"][TABLE]:
            it = {k: des.deserialize(v) for k, v in raw.items()}
            det = it.get("details") or {}
            if it["status"] == "shadow":
                shadow += 1
            elif it["status"] == "failed":
                failed += 1
            elif det.get("outcome") == "exception":
                exceptions.append((it["candidateKey"], det.get("reason")))
            else:
                created.append(it["candidateKey"])
    print("shadow", shadow, "failed", failed)
    print("exceptions", json.dumps(exceptions, indent=1))
    mapping_ids = []
    for key in created:
        m = ddb.get_item(Key={"pk": f"PROJECTION#{SOURCE_ID}#{key}", "sk": "STATE"}).get("Item") or {}
        mapping_ids.append({"candidateKey": key, "eventId": m.get("eventId"), "artistId": m.get("artistId"), "venueId": m.get("venueId")})
    print("created", json.dumps(mapping_ids, indent=1))
    stop = counts.get("artistsCreated", 0) or counts.get("venuesCreated", 0) or counts.get("projectionFailures", 0)
    print("STOP CONDITION HIT" if stop else "no stop condition hit")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("step", choices=["status", "arm", "disarm", "open", "close", "send", "watch"])
    parser.add_argument("--keys", default="")
    parser.add_argument("--run-id", default="")
    args = parser.parse_args()
    if args.step == "status":
        status()
    elif args.step == "arm":
        arm([k.strip() for k in args.keys.split(",") if k.strip()])
    elif args.step == "disarm":
        disarm()
    elif args.step == "open":
        if not args.run_id:
            sys.exit("--run-id required")
        open_window(args.run_id)
    elif args.step == "close":
        close_window()
    elif args.step == "send":
        if not args.run_id:
            sys.exit("--run-id required")
        send(args.run_id)
    elif args.step == "watch":
        if not args.run_id:
            sys.exit("--run-id required")
        watch(args.run_id)


if __name__ == "__main__":
    main()
