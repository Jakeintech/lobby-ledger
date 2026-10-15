-- @param key STRING
-- Bill redirect: the newest congress that has one bill key, for /bill/:key.
SELECT congress, bill_key
FROM workspace.gold.bill_congress
WHERE bill_key = upper(:key)
ORDER BY congress DESC
LIMIT 1
