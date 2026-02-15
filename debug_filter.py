import sys
import os
import asyncio
from backend.acquisition.stage1_filter import IntentAnalyzer, FinancialFilter, FilterCriteria

# Add current directory to path so imports work
sys.path.append(os.getcwd())

async def debug_search(prompt):
    print(f"\n--- Debugging Prompt: '{prompt}' ---")
    
    # 1. Analyze Intent
    print("1. Analyzing Intent...")
    analyzer = IntentAnalyzer()
    try:
        criteria = analyzer.parse_prompt(prompt)
        print("Generated Criteria:")
        print(f"  Min Revenue: {criteria.min_revenue}")
        print(f"  Min Margin: {criteria.min_ebitda_margin}")
        print(f"  Min Growth: {criteria.min_growth}")
        print(f"  Industries: {criteria.industries}")
        print(f"  Custom SQL: {criteria.custom_sql_conditions}")
        print(f"  Description: {criteria.description}")
    except Exception as e:
        print(f"Intent Analysis Failed: {e}")
        return

    # 2. Run Filter
    print("\n2. Running Filter...")
    filter_engine = FinancialFilter()
    try:
        # We want to see the SQL, so let's peek at the internal method if possible or just run it
        # The filter method logs debug SQL, but we can't see it easily.
        # Let's try to manually construct the SQL logic here to verify what it WOULD do
        
        # Replicating logic from FinancialFilter.filter for debugging print
        where_parts = ["1=1"]
        if criteria.min_revenue > 0:
            where_parts.append(f"m.latest_revenue_sek >= {criteria.min_revenue}")
        if criteria.min_ebitda_margin > -1.0:
            where_parts.append(f"m.avg_ebitda_margin >= {criteria.min_ebitda_margin}")
        if criteria.min_growth > -1.0:
            where_parts.append(f"m.revenue_cagr_3y >= {criteria.min_growth}")
            
        if criteria.industries:
            # SQLite check logic
            or_conditions = []
            for code in criteria.industries:
                or_conditions.append(f"c.nace_codes LIKE '%\"{code}\"%'")
            if or_conditions:
                where_parts.append(f"({' OR '.join(or_conditions)})")
                
        print(f"Constructed WHERE clause parts: {where_parts}")
        
        # Run actual filter
        stats = filter_engine.get_filter_stats(criteria)
        print(f"\n3. Results:")
        print(f"  Total Matches: {stats.get('total_matches')}")
        print(f"  Will Return: {stats.get('will_return')}")
        
    except Exception as e:
        print(f"Filter Execution Failed: {e}")

if __name__ == "__main__":
    # Test with the user's prompt
    prompt = "find comapnies with ca 100m turnover and works in clothes"
    asyncio.run(debug_search(prompt))
