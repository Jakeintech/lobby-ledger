-- @param congress STRING
-- @param key STRING
-- Bill page chart markers: legislative milestones for one bill in one congress.
SELECT congress, bill_key, milestone, milestone_date
FROM workspace.gold.bill_milestone
WHERE congress = CAST(:congress AS INT) AND bill_key = upper(:key)
ORDER BY milestone_date
LIMIT 10
