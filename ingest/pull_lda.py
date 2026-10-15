"""Pull U.S. Lobbying Disclosure Act filings into source-shaped CSVs.

This script stands in for a change-data-capture tool: it lands source data
as-is, adds no business logic, and leaves modeling to SQL.

Slice: every registrant-client pair that reported income of at least
SEED_MIN_INCOME on any filing in YEARS, with its complete filing history for
those years. The LDA API ignores issue-code filters, so topics are derived
from the data in Silver and Gold rather than requested here.

The script is restartable: every API page is cached as JSON under data/raw
and reused on the next run.

Usage: python3 ingest/pull_lda.py
Output: data/raw/**/*.json (not committed) and data/*.csv
"""

import csv
import json
import os
import sys
import time

import requests

API = "https://lda.gov/api/v1/filings/"
YEARS = [2024, 2025]
SEED_MIN_INCOME = 500000
PAGE_SIZE = 25  # the API caps pages at 25 rows
SLEEP_SECONDS = 1.0

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
RAW = os.path.join(DATA, "raw")


def get(params, cache_path):
    """GET one page, cached on disk so a rerun never hits the API twice."""
    if os.path.exists(cache_path):
        with open(cache_path) as fh:
            return json.load(fh)
    params = dict(params, format="json", page_size=PAGE_SIZE)
    for attempt in range(6):
        resp = requests.get(API, params=params, timeout=60)
        if resp.status_code == 429:
            wait = 15 * (attempt + 1)
            print(f"  rate limited, waiting {wait}s", flush=True)
            time.sleep(wait)
            continue
        if resp.status_code >= 500:
            time.sleep(5)
            continue
        resp.raise_for_status()
        body = resp.json()
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        with open(cache_path, "w") as fh:
            json.dump(body, fh)
        time.sleep(SLEEP_SECONDS)
        return body
    raise RuntimeError(f"gave up after retries: {params}")


def paged(params, cache_prefix):
    page = 1
    while True:
        body = get(dict(params, page=page), f"{cache_prefix}_p{page}.json")
        yield from body["results"]
        if not body.get("next"):
            return
        page += 1


def seed_pairs():
    """Every registrant-client pair with a large filing in any of YEARS."""
    pairs = {}
    for year in YEARS:
        n = 0
        for f in paged({"filing_year": year, "filing_amount_reported_min": SEED_MIN_INCOME, "ordering": "-income"},
                       os.path.join(RAW, "seed", f"{year}")):
            n += 1
            key = (f["registrant"]["id"], f["client"]["id"])
            pairs.setdefault(key, f["registrant"]["name"])
        print(f"seed {year}: {n} filings, {len(pairs)} pairs so far", flush=True)
    return sorted(pairs)


def pull_history(pairs):
    """Every filing in YEARS for each pair, including registrations and amendments."""
    seen = {}
    for i, (registrant_id, client_id) in enumerate(pairs, 1):
        for year in YEARS:
            prefix = os.path.join(RAW, "pairs", f"{registrant_id}_{client_id}_{year}")
            for f in paged({"registrant_id": registrant_id, "client_id": client_id, "filing_year": year}, prefix):
                seen[f["filing_uuid"]] = f
        if i % 25 == 0 or i == len(pairs):
            print(f"history: {i}/{len(pairs)} pairs, {len(seen)} filings", flush=True)
    return list(seen.values())


def write_csv(name, rows, fields):
    path = os.path.join(DATA, f"{name}.csv")
    with open(path, "w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    print(f"wrote {len(rows):>6} rows to data/{name}.csv", flush=True)


def clean(text):
    return (text or "").replace("\r", " ").replace("\n", " ")


def flatten(filings):
    out = {"filings": [], "registrants": {}, "clients": {}, "lobbyists": [],
           "lobbying_activities": [], "government_entities": []}
    for f in filings:
        r, c = f["registrant"], f["client"]
        out["filings"].append({
            "filing_uuid": f["filing_uuid"],
            "registrant_id": r["id"],
            "client_id": c["id"],
            "filing_type": f["filing_type"],
            "filing_type_display": f["filing_type_display"],
            "filing_year": f["filing_year"],
            "filing_period": f["filing_period"],
            "income": f["income"],
            "expenses": f["expenses"],
            "termination_date": f["termination_date"],
            "dt_posted": f["dt_posted"],
            "filing_document_url": f["filing_document_url"],
        })
        out["registrants"][r["id"]] = {
            "registrant_id": r["id"], "name": r["name"], "description": clean(r["description"]),
            "city": r["city"], "state": r["state"], "country": r["country"], "dt_updated": r["dt_updated"],
        }
        out["clients"][c["id"]] = {
            "client_id": c["id"], "name": c["name"], "general_description": clean(c["general_description"]),
            "state": c["state"], "country": c["country"], "effective_date": c["effective_date"],
        }
        for a in f.get("lobbying_activities") or []:
            code = a["general_issue_code"]
            out["lobbying_activities"].append({
                "filing_uuid": f["filing_uuid"],
                "general_issue_code": code,
                "general_issue_code_display": a["general_issue_code_display"],
                "specific_issues": clean(a["description"]),
            })
            for l in a.get("lobbyists") or []:
                p = l["lobbyist"]
                out["lobbyists"].append({
                    "filing_uuid": f["filing_uuid"],
                    "general_issue_code": code,
                    "lobbyist_id": p["id"],
                    "first_name": p["first_name"],
                    "last_name": p["last_name"],
                    "covered_position": clean(l["covered_position"]),
                    "is_new": l["new"],
                })
            for g in a.get("government_entities") or []:
                out["government_entities"].append({
                    "filing_uuid": f["filing_uuid"],
                    "general_issue_code": code,
                    "entity_id": g.get("id"),
                    "entity_name": clean(g.get("name")),
                })
    return out


def main():
    os.makedirs(RAW, exist_ok=True)
    pairs = seed_pairs()
    print(f"{len(pairs)} pairs to pull", flush=True)
    filings = pull_history(pairs)
    print(f"{len(pairs)} engagements, {len(filings)} filings", flush=True)
    if not filings:
        sys.exit("no filings pulled")
    flat = flatten(filings)
    write_csv("filings", flat["filings"], list(flat["filings"][0]))
    write_csv("registrants", list(flat["registrants"].values()), list(next(iter(flat["registrants"].values()))))
    write_csv("clients", list(flat["clients"].values()), list(next(iter(flat["clients"].values()))))
    write_csv("lobbyists", flat["lobbyists"], list(flat["lobbyists"][0]))
    write_csv("lobbying_activities", flat["lobbying_activities"], list(flat["lobbying_activities"][0]))
    write_csv("government_entities", flat["government_entities"], list(flat["government_entities"][0]))


if __name__ == "__main__":
    main()
