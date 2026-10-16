-- @param code STRING
-- Topic page section: the House and Senate committees with jurisdiction over one issue code.
SELECT issue_code, chamber, thomas_id, committee_name
FROM workspace.gold.issue_committee
WHERE issue_code = upper(:code)
ORDER BY chamber, committee_name
LIMIT 10
