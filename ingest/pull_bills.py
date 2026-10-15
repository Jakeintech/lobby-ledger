"""Enrich the bills that lobbying filings mention from the Congress.gov API.

Reads the distinct (congress, bill type, number) keys from the Gold layer,
fetches each bill once from api.congress.gov (cached under data/raw/bills),
and writes two source-shaped CSVs: data/bills.csv (one row per bill) and
data/bill_actions.csv (one row per recorded action). The SQL layer turns the
actions into milestones.

Needs CONGRESS_API_KEY (free, https://api.congress.gov/sign-up) and the same
Databricks variables as sql/run_sql.py.

Usage: python3 ingest/pull_bills.py
"""

import csv
import json
import os
import sys
import time

import requests

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sql"))
from run_sql import run  # noqa: E402

API = "https://api.congress.gov/v3/bill"
API_KEY = os.environ.get("CONGRESS_API_KEY", "").strip()
SLEEP_SECONDS = 0.8  # 5,000 requests per hour allowed; this stays well under
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
RAW = os.path.join(DATA, "raw", "bills")

# Congress.gov bill types, keyed by the normalized prefix used in Gold bill keys.
TYPES = {"HR": "hr", "S": "s", "HJRES": "hjres", "SJRES": "sjres", "HCONRES": "hconres",
         "SCONRES": "sconres", "HRES": "hres", "SRES": "sres"}


def get(url, cache_path):
    if os.path.exists(cache_path):
        with open(cache_path) as fh:
            return json.load(fh)
    for attempt in range(6):
        resp = requests.get(url, params={"api_key": API_KEY, "format": "json", "limit": 250}, timeout=60)
        if resp.status_code == 429:
            time.sleep(30 * (attempt + 1))
            continue
        if resp.status_code == 404:
            body = {"missing": True}
            break
        if resp.status_code >= 500:
            time.sleep(5)
            continue
        resp.raise_for_status()
        body = resp.json()
        break
    else:
        raise RuntimeError(f"gave up: {url}")
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    with open(cache_path, "w") as fh:
        json.dump(body, fh)
    time.sleep(SLEEP_SECONDS)
    return body


def bill_keys():
    """Every (congress, bill_key) Gold knows about, with its prefix and number."""
    resp = run("SELECT DISTINCT congress, bill_key FROM gold.bill_congress ORDER BY congress, bill_key",
               os.environ["DATABRICKS_WAREHOUSE_ID"], os.environ.get("DATABRICKS_CATALOG", "workspace"))
    rows = resp.get("result", {}).get("data_array") or []
    out = []
    for congress, key in rows:
        prefix = "".join(ch for ch in key if ch.isalpha())
        number = "".join(ch for ch in key if ch.isdigit())
        if prefix in TYPES and number:
            out.append((int(congress), key, TYPES[prefix], number))
    return out


def main():
    if not API_KEY:
        sys.exit("set CONGRESS_API_KEY")
    keys = bill_keys()
    print(f"{len(keys)} bills to fetch", flush=True)
    bills, actions = [], []
    for i, (congress, key, btype, number) in enumerate(keys, 1):
        base = f"{API}/{congress}/{btype}/{number}"
        detail = get(base, os.path.join(RAW, f"{congress}_{key}.json")).get("bill") or {}
        if detail:
            acts = get(f"{base}/actions", os.path.join(RAW, f"{congress}_{key}_actions.json")).get("actions") or []
            sponsors = detail.get("sponsors") or []
            bills.append({
                "congress": congress, "bill_key": key, "bill_type": detail.get("type"), "number": detail.get("number"),
                "title": (detail.get("title") or "").replace("\n", " "),
                "policy_area": (detail.get("policyArea") or {}).get("name"),
                "sponsor_bioguide_id": sponsors[0].get("bioguideId") if sponsors else None,
                "sponsor_name": sponsors[0].get("fullName") if sponsors else None,
                "sponsor_party": sponsors[0].get("party") if sponsors else None,
                "sponsor_state": sponsors[0].get("state") if sponsors else None,
                "introduced_date": detail.get("introducedDate"),
                "latest_action_date": (detail.get("latestAction") or {}).get("actionDate"),
                "latest_action_text": ((detail.get("latestAction") or {}).get("text") or "").replace("\n", " "),
                "is_law": bool(detail.get("laws")),
                "congress_url": f"https://www.congress.gov/bill/{congress}th-congress/{btype}/{number}",
            })
            for a in acts:
                actions.append({
                    "congress": congress, "bill_key": key, "action_date": a.get("actionDate"),
                    "action_code": a.get("actionCode"), "action_type": a.get("type"),
                    "source_system": (a.get("sourceSystem") or {}).get("name"),
                    "text": (a.get("text") or "").replace("\n", " "),
                })
        if i % 100 == 0 or i == len(keys):
            print(f"{i}/{len(keys)} bills, {len(actions)} actions", flush=True)
    for name, rows in (("bills", bills), ("bill_actions", actions)):
        if not rows:
            continue
        with open(os.path.join(DATA, f"{name}.csv"), "w", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=list(rows[0]))
            w.writeheader()
            w.writerows(rows)
        print(f"wrote {len(rows):>6} rows to data/{name}.csv", flush=True)


if __name__ == "__main__":
    main()
