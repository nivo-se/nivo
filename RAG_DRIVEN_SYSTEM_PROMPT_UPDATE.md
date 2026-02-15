# RAG-Driven System Prompt Update

## Summary
Refactored the AI filter system prompt to rely on RAG context instead of hardcoded instructions, making the system more maintainable and flexible.

---

## Changes Made

### Before: Hardcoded Instructions (Redundant with RAG)
```python
system_prompt = (
    f"{rag_context}\n\n"
    "GLOBAL RULES:\n"
    "- ALWAYS exclude real estate/property, fund/investment, and consulting firms...\n"
    "- For profitability: use `k.avg_net_margin > 5.0` OR...\n"
    "- For manufacturing: use `c.nace_categories LIKE '%tillverk%'...\n"
    "- For revenue ranges: use `f.max_revenue_sek BETWEEN X AND Y`...\n"
    # ... many more hardcoded examples
)
```

**Problems:**
- Duplicated information already in RAG context
- Hard to maintain (changes needed in two places)
- Less flexible (can't update without code changes)
- Verbose and cluttered

### After: RAG-Driven (Concise and Maintainable)
```python
system_prompt = (
    f"{rag_context}\n\n"
    "TASK: Generate a SQL WHERE clause from the user's natural language prompt.\n\n"
    "CRITICAL RULES:\n"
    "1. Use ONLY the columns listed in the 'Valid Fields' section above.\n"
    "2. ALWAYS apply automatic exclusions as specified in the context.\n"
    "3. Keep filters additive unless the user explicitly requests removal.\n"
    "4. Follow the example prompts in the context for correct SQL patterns.\n\n"
    "OUTPUT FORMAT (JSON):\n"
    # ... JSON format specification
)
```

**Benefits:**
- ✅ Relies on RAG for detailed guidance
- ✅ Single source of truth (RAG context)
- ✅ Easy to update (just edit `rag_context.md`)
- ✅ More concise and focused
- ✅ Better separation of concerns

---

## What RAG Context Provides

The RAG context (`data/rag_context.md`) now contains all the detailed guidance:

1. **Valid Fields** - Complete list of available columns and their usage
2. **Business Logic** - How to interpret margins, growth, etc.
3. **Automatic Exclusions** - Patterns for excluding real estate, funds, consulting
4. **Example Prompts** - Real SQL examples for common queries
5. **Industry-Specific Guidance** - Manufacturing filter patterns, etc.
6. **Warnings** - What NOT to do (hallucinate fields, use wrong patterns)

---

## Test Results

### Test 1: Manufacturing Query
**Prompt:** "Find profitable manufacturing companies with revenue between 50-100 million SEK"

**Results:**
- ✅ Total matches: 285 (correct, not capped)
- ✅ Uses correct manufacturing filter: `%tillverk%` or `%produktion%`
- ✅ Applies automatic exclusions
- ✅ LLM Used: True

### Test 2: Tech Companies Query
**Prompt:** "Find tech companies with high growth and revenue over 20 million SEK"

**Results:**
- ✅ Total matches: 204
- ✅ Uses correct fields: `f.max_revenue_sek`, `k.revenue_growth` or `growth_bucket`
- ✅ Applies automatic exclusions

### Test 3: Growth + Profitability Query
**Prompt:** "Show me companies with flat growth and strong profitability"

**Results:**
- ✅ Total matches: 483
- ✅ Uses bucket filters: `growth_bucket = 'flat'`, `profitability_bucket = 'high'`
- ✅ Applies automatic exclusions

---

## Key Improvements

1. **Maintainability**: Update RAG context file instead of code
2. **Consistency**: Single source of truth for all guidance
3. **Flexibility**: Easy to add new examples or patterns
4. **Clarity**: System prompt focuses on task and format, not details
5. **Accuracy**: RAG provides context-aware guidance based on query

---

## Migration Notes

- ✅ RAG service working (ChromaDB indexed, embeddings functional)
- ✅ All existing queries still work correctly
- ✅ No breaking changes to API
- ✅ Backward compatible

---

## Future Enhancements

1. **Dynamic RAG Updates**: Automatically re-index when `rag_context.md` changes
2. **Query-Specific Context**: Retrieve only relevant sections based on query
3. **More Examples**: Add more industry-specific examples to RAG context
4. **Validation**: Add schema validation to catch invalid SQL patterns early

---

## Files Modified

1. `backend/api/ai_filter.py` - Simplified system prompt
2. `data/rag_context.md` - Already contains all detailed guidance
3. `RAG_DRIVEN_SYSTEM_PROMPT_UPDATE.md` - This documentation

---

## Conclusion

The system is now more maintainable, flexible, and accurate. All detailed guidance lives in the RAG context, making it easy to update without code changes. The LLM receives context-aware guidance that adapts to the query, resulting in better SQL generation.

