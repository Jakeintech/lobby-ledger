"""Pull U.S. Lobbying Disclosure Act filings into source-shaped CSVs.

This script stands in for a CDC tool (for example Qlik Replicate): it lands
source data as-is, adds no business logic, and leaves modeling to SQL.

Strategy: sample current engagements (registrant + client pairs) for a few
lobbying firms in the chosen issue areas, then pull every 2024-2025 filing for
each engagement so the vault sees the same engagement across many quarters.

Usage: python3 ingest/pull_lda.py
Output: data/raw/*.json (not committed) and data/*.csv
"""

import csv
import json
import os
import time

import requests

API = "https://lda.gov/api/v1/filings/"
YEARS = [2024, 2025]
ISSUE_CODES = {"TEC", "FIN", "HCR", "TAX"}
FIRMS = ["Akin", "Holland & Knight", "Brownstein Hyatt", "Squire Patton Boggs"]
ENGAGEMENTS_PER_FIRM = 12
SLEEP_SECONDS = 1.0

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
RAW = os.path.join(DATA, "raw")


def get(params):
    params = dict(params, format="json")
    for attempt in range(5):
        resp = requests.get(API, params=params, timeout=60)
        if resp.status_code == 429:
            time.sleep(10 * (attempt + 1))
            continue
        resp.raise_for_status()
        time.sleep(SLEEP_SECONDS)
        return resp.json()
    raise RuntimeError(f"rate limited too many times: {params}")


def issue_codes(filing):
    return {a["general_issue_code"] for a in filing.get("lobbying_activities") or []}


def sample_engagements():
    """Pick registrant/client pairs from recent filings that touch our issue codes."""
    pairs = {}
    for firm in FIRMS:
        found = 0
        for page in (1, 2, 3):
            body = get({"registrant_name": firm, "filing_year": 2025, "page": page})
            for f in body["results"]:
                if not issue_codes(f) & ISSUE_CODES:
                    continue
                key = (f["registrant"]["id"], f["client"]["id"])
                if key not in pairs:
                    pairs[key] = firm
                    found += 1
                if found >= ENGAGEMENTS_PER_FIRM:
                    break
            if found >= ENGAGEMENTS_PER_FIRM or not body.get("next"):
                break
        print(f"{firm}: {found} engagements")
    return list(pairs)


def pull_history(pairs):
    filings = []
    for registrant_id, client_id in pairs:
        page = 1
        while True:
            body = get({"registrant_id": registrant_id, "client_id": client_id, "page": page})
            filings.extend(f for f in body["results"] if f["filing_year"] in YEARS)
            if not body.get("next"):
                break
            page += 1
    return filings


def write_csv(name, rows, fields):
    path = os.path.join(DATA, f"{name}.csv")
    with open(path, "w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    print(f"wrote {len(rows):>5} rows to data/{name}.csv")


def flatten(filings):
    out = {"filings": [], "registrants": {}, "clients": {}, "lobbyists": [], "lobbying_activities": []}
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
            "registrant_id": r["id"], "name": r["name"], "description": r["description"],
            "city": r["city"], "state": r["state"], "country": r["country"], "dt_updated": r["dt_updated"],
        }
        out["clients"][c["id"]] = {
            "client_id": c["id"], "name": c["name"], "general_description": c["general_description"],
            "state": c["state"], "country": c["country"], "effective_date": c["effective_date"],
        }
        for a in f.get("lobbying_activities") or []:
            out["lobbying_activities"].append({
                "filing_uuid": f["filing_uuid"],
                "general_issue_code": a["general_issue_code"],
                "general_issue_code_display": a["general_issue_code_display"],
                "specific_issues": (a["description"] or "").replace("\r", " ").replace("\n", " "),
            })
            for l in a.get("lobbyists") or []:
                p = l["lobbyist"]
                out["lobbyists"].append({
                    "filing_uuid": f["filing_uuid"],
                    "general_issue_code": a["general_issue_code"],
                    "lobbyist_id": p["id"],
                    "first_name": p["first_name"],
                    "last_name": p["last_name"],
                    "covered_position": (l["covered_position"] or "").replace("\n", " "),
                    "is_new": l["new"],
                })
    return out


def main():
    os.makedirs(RAW, exist_ok=True)
    pairs = sample_engagements()
    filings = pull_history(pairs)
    with open(os.path.join(RAW, "filings.json"), "w") as fh:
        json.dump(filings, fh)
    print(f"{len(pairs)} engagements, {len(filings)} filings")

    flat = flatten(filings)
    write_csv("filings", flat["filings"], list(flat["filings"][0]))
    write_csv("registrants", list(flat["registrants"].values()), list(next(iter(flat["registrants"].values()))))
    write_csv("clients", list(flat["clients"].values()), list(next(iter(flat["clients"].values()))))
    write_csv("lobbyists", flat["lobbyists"], list(flat["lobbyists"][0]))
    write_csv("lobbying_activities", flat["lobbying_activities"], list(flat["lobbying_activities"][0]))


if __name__ == "__main__":
    main()
