-- @param country STRING
-- Foreign country page chart: income on foreign-linked filings for one country by quarter.
SELECT country, period_end_date,
       CAST(income AS DOUBLE) AS income,
       engagement_count
FROM workspace.gold.foreign_country_quarter
WHERE country = :country
ORDER BY period_end_date
LIMIT 8
