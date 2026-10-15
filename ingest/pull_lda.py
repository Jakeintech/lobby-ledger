"""Pull every U.S. Lobbying Disclosure Act filing for YEARS into source-shaped CSVs.

This script stands in for a change-data-capture tool: it lands source data
as-is, adds no business logic, and leaves modeling to SQL.

It pages through the filings endpoint year by year, caches every page as
JSON under data/raw/all, and streams flattened rows straight into the CSVs
so memory stays flat at any volume. A rerun re-reads cached pages from disk
and only calls the API for pages it has not seen.

Set LDA_API_KEY (free, from lda.gov) for the authenticated rate limit; the
anonymous limit is far lower and the script slows itself down accordingly.

Usage: python3 ingest/pull_lda.py
Output: data/raw/all/*.json (not committed) and data/*.csv (not committed)
"""

import csv
import json
import math
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor

import requests

API = "https://lda.gov/api/v1/filings/"
YEARS = [2024, 2025]
PAGE_SIZE = 25  # the API caps pages at 25 rows
API_KEY = os.environ.get("LDA_API_KEY", "").strip()
SLEEP_SECONDS = 2.0 if API_KEY else 4.0
WORKERS = 4 if API_KEY else 1  # 4 workers x 2s sleep stays under the 120 requests per minute limit

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
RAW = os.path.join(DATA, "raw", "all")

HEADERS = {
    "filings": ["filing_uuid", "registrant_id", "client_id", "filing_type", "filing_type_display", "filing_year",
                "filing_period", "income", "expenses", "expenses_method", "termination_date", "dt_posted",
                "posted_by_name", "filing_document_url"],
    "registrants": ["registrant_id", "name", "description", "city", "state", "country", "dt_updated"],
    "clients": ["client_id", "name", "general_description", "state", "country", "ppb_country", "effective_date"],
    "lobbyists": ["filing_uuid", "general_issue_code", "lobbyist_id", "first_name", "last_name",
                  "covered_position", "is_new"],
    "lobbying_activities": ["filing_uuid", "general_issue_code", "general_issue_code_display", "specific_issues"],
    "government_entities": ["filing_uuid", "general_issue_code", "entity_id", "entity_name"],
    "foreign_entities": ["filing_uuid", "name", "country", "ppb_country", "ownership_percentage", "contribution"],
    "affiliated_organizations": ["filing_uuid", "name", "country", "ppb_country"],
}


def get(params, cache_path):
    """GET one page, cached on disk so a rerun never hits the API twice."""
    if os.path.exists(cache_path):
        with open(cache_path) as fh:
            return json.load(fh)
    headers = {"Authorization": f"Token {API_KEY}"} if API_KEY else {}
    params = dict(params, format="json", page_size=PAGE_SIZE)
    for attempt in range(8):
        resp = requests.get(API, params=params, headers=headers, timeout=90)
        if resp.status_code == 429:
            wait = 10 * (attempt + 1)
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


def clean(text):
    return (text or "").replace("\r", " ").replace("\n", " ")


class Writers:
    """One CSV writer per source entity, opened once, written row by row."""

    def __init__(self):
        self.files, self.writers = {}, {}
        for name, fields in HEADERS.items():
            fh = open(os.path.join(DATA, f"{name}.csv"), "w", newline="")
            self.files[name] = fh
            self.writers[name] = csv.DictWriter(fh, fieldnames=fields)
            self.writers[name].writeheader()
        self.counts = {name: 0 for name in HEADERS}

    def write(self, name, row):
        self.writers[name].writerow(row)
        self.counts[name] += 1

    def close(self):
        for fh in self.files.values():
            fh.close()


def flatten_into(f, w, registrants, clients):
    r, c = f["registrant"], f["client"]
    w.write("filings", {
        "filing_uuid": f["filing_uuid"], "registrant_id": r["id"], "client_id": c["id"],
        "filing_type": f["filing_type"], "filing_type_display": f["filing_type_display"],
        "filing_year": f["filing_year"], "filing_period": f["filing_period"],
        "income": f["income"], "expenses": f["expenses"], "expenses_method": f.get("expenses_method"),
        "termination_date": f["termination_date"], "dt_posted": f["dt_posted"],
        "posted_by_name": clean(f.get("posted_by_name")), "filing_document_url": f["filing_document_url"],
    })
    registrants[r["id"]] = {
        "registrant_id": r["id"], "name": r["name"], "description": clean(r["description"]),
        "city": r["city"], "state": r["state"], "country": r["country"], "dt_updated": r["dt_updated"],
    }
    clients[c["id"]] = {
        "client_id": c["id"], "name": c["name"], "general_description": clean(c["general_description"]),
        "state": c["state"], "country": c["country"], "ppb_country": c.get("ppb_country"),
        "effective_date": c["effective_date"],
    }
    for a in f.get("lobbying_activities") or []:
        code = a["general_issue_code"]
        w.write("lobbying_activities", {
            "filing_uuid": f["filing_uuid"], "general_issue_code": code,
            "general_issue_code_display": a["general_issue_code_display"],
            "specific_issues": clean(a["description"]),
        })
        for l in a.get("lobbyists") or []:
            p = l["lobbyist"]
            w.write("lobbyists", {
                "filing_uuid": f["filing_uuid"], "general_issue_code": code, "lobbyist_id": p["id"],
                "first_name": p["first_name"], "last_name": p["last_name"],
                "covered_position": clean(l["covered_position"]), "is_new": l["new"],
            })
        for g in a.get("government_entities") or []:
            w.write("government_entities", {
                "filing_uuid": f["filing_uuid"], "general_issue_code": code,
                "entity_id": g.get("id"), "entity_name": clean(g.get("name")),
            })
    for e in f.get("foreign_entities") or []:
        w.write("foreign_entities", {
            "filing_uuid": f["filing_uuid"], "name": clean(e.get("name")), "country": e.get("country"),
            "ppb_country": e.get("ppb_country"), "ownership_percentage": e.get("ownership_percentage"),
            "contribution": e.get("contribution"),
        })
    for o in f.get("affiliated_organizations") or []:
        w.write("affiliated_organizations", {
            "filing_uuid": f["filing_uuid"], "name": clean(o.get("name")), "country": o.get("country"),
            "ppb_country": o.get("ppb_country"),
        })


def main():
    os.makedirs(RAW, exist_ok=True)
    print(f"api key: {'yes' if API_KEY else 'no'}, sleep {SLEEP_SECONDS}s", flush=True)
    w = Writers()
    registrants, clients, seen = {}, {}, set()
    def fetch(year, page):
        return get({"filing_year": year, "ordering": "dt_posted", "page": page},
                   os.path.join(RAW, f"{year}_p{page}.json"))

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for year in YEARS:
            first = fetch(year, 1)
            total = first.get("count") or 0
            pages = max(1, math.ceil(total / PAGE_SIZE))
            print(f"{year}: {total} filings, {pages} pages", flush=True)
            for start in range(1, pages + 1, WORKERS):
                batch = list(range(start, min(start + WORKERS, pages + 1)))
                for body in pool.map(lambda pg: fetch(year, pg), batch):
                    for f in body["results"]:
                        if f["filing_uuid"] in seen:
                            continue
                        seen.add(f["filing_uuid"])
                        flatten_into(f, w, registrants, clients)
                if batch[-1] % 100 < WORKERS or batch[-1] == pages:
                    print(f"{year}: page {batch[-1]} of {pages}, {len(seen)} filings", flush=True)
    for row in registrants.values():
        w.write("registrants", row)
    for row in clients.values():
        w.write("clients", row)
    w.close()
    for name, n in w.counts.items():
        print(f"wrote {n:>8} rows to data/{name}.csv", flush=True)
    if not seen:
        sys.exit("no filings pulled")


if __name__ == "__main__":
    main()
