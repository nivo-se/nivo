
# DATABASE_SCHEMA.md

## companies

id
name
org_number
website
industry

## research_facts

id
company_id
fact_type
fact_value
confidence_score
source_url
retrieved_at
agent

## competitors

id
company_id
competitor_name
revenue_estimate
margin_estimate
segment

## transactions

id
industry
company
year
EV
EBITDA
multiple
buyer
