# Lobbying Experience Search

A miniature Databricks lakehouse built on public U.S. Lobbying Disclosure Act filings. Lobbying firms file a report every quarter for every client they represent, listing the lobbyists who worked on it, the issues they covered and what they were paid. This repo lands those filings in a Bronze layer, models them as a Data Vault 2.0 in Silver, publishes a Business Vault and marts in Gold, and puts a small Databricks AppKit app on top that answers one question: "find every engagement like this one, who worked it, and what it was about."

The domain is a stand-in for professional-services data: a lobbying firm is the firm, a lobbyist is a timekeeper, a general issue code is a practice group, and a firm-client engagement is a matter observed once per quarter.

Work in progress.
