-- ai_summaries.sql
-- Optional: one plain sentence per engagement from a foundation model.
-- Not part of the standard build. Only engagements without a summary are sent.
-- Run with: python3 sql/run_sql.py sql/ai_summaries.sql (set AI_ENDPOINT)

INSERT INTO gold.engagement_ai_summary
SELECT t.engagement_hk,
       ai_query('${AI_ENDPOINT}',
         concat('In one plain sentence of at most 30 words, summarize what this lobbying engagement was about. ',
                'Issue codes: ', t.issue_codes, '. Filing text: ', t.issues_text)),
       '${AI_ENDPOINT}', current_timestamp()
FROM gold.engagement_issue_text t
WHERE NOT EXISTS (SELECT 1 FROM gold.engagement_ai_summary s WHERE s.engagement_hk = t.engagement_hk);
