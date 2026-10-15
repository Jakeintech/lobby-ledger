-- About page and footer: newest quarter in the data and how much it covers.
SELECT max(period_end_date) AS latest_period,
       CAST(count(DISTINCT engagement_hk) AS INT) AS engagement_count,
       CAST(count(*) AS INT) AS filing_count
FROM workspace.gold.fact_filing
LIMIT 1
