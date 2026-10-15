-- @param engagement_hk STRING
-- Bills mentioned in this engagement's filing text, extracted in Gold from
-- the free-text "specific issues" field. Soft rule, so it lives in Gold.
SELECT bill_label, bill_key, issue_codes,
       CAST(filings_mentioning AS INT) AS filings_mentioning,
       first_period, last_period
FROM workspace.gold.engagement_bill
WHERE engagement_hk = :engagement_hk
ORDER BY filings_mentioning DESC, bill_label
