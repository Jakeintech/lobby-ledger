"""Run a .sql file statement by statement against a Databricks SQL warehouse.

Uses the Databricks CLI (OAuth login) and the SQL Statement Execution API,
so no token ever touches this repo.

Usage: python3 sql/run_sql.py sql/lakehouse.sql
Env:   DATABRICKS_WAREHOUSE_ID (required), DATABRICKS_CATALOG (default: workspace),
       AI_ENDPOINT (default: databricks-meta-llama-3-3-70b-instruct)
"""

import json
import os
import subprocess
import sys
import time


def run(statement, warehouse_id, catalog):
    body = {"statement": statement, "warehouse_id": warehouse_id, "catalog": catalog, "wait_timeout": "50s"}
    out = subprocess.run(["databricks", "api", "post", "/api/2.0/sql/statements", "--json", json.dumps(body)],
                         capture_output=True, text=True, check=True)
    resp = json.loads(out.stdout)
    while resp["status"]["state"] in ("PENDING", "RUNNING"):
        time.sleep(3)
        out = subprocess.run(["databricks", "api", "get", f"/api/2.0/sql/statements/{resp['statement_id']}"],
                             capture_output=True, text=True, check=True)
        resp = json.loads(out.stdout)
    return resp


def split(sql):
    lines = [line for line in sql.splitlines() if not line.strip().startswith("--")]
    return [s.strip() for s in "\n".join(lines).split(";") if s.strip()]


def main():
    path = sys.argv[1]
    warehouse_id = os.environ["DATABRICKS_WAREHOUSE_ID"]
    catalog = os.environ.get("DATABRICKS_CATALOG", "workspace")
    endpoint = os.environ.get("AI_ENDPOINT", "databricks-meta-llama-3-3-70b-instruct")
    sql = open(path).read().replace("${AI_ENDPOINT}", endpoint)
    for statement in split(sql):
        first_line = statement.splitlines()[0][:90]
        resp = run(statement, warehouse_id, catalog)
        state = resp["status"]["state"]
        print(f"{state:<10} {first_line}")
        if state != "SUCCEEDED":
            print(json.dumps(resp["status"], indent=2))
            sys.exit(1)
        rows = resp.get("result", {}).get("data_array")
        if rows and not statement.upper().startswith(("INSERT", "CREATE")):
            for row in rows[:200]:
                print("    ", row)


if __name__ == "__main__":
    main()
