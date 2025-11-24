"""
Test script for the new acquisition workflow

Tests the 3-stage workflow with a small sample.
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.acquisition.stage1_filter import FilterCriteria, FinancialFilter
from backend.acquisition.workflow import AcquisitionWorkflow


async def test_workflow():
    """Test the complete workflow"""
    print("=" * 60)
    print("Testing Acquisition Workflow")
    print("=" * 60)
    
    # Define test criteria (very relaxed to get some results)
    criteria = FilterCriteria(
        min_revenue=50_000_000,  # 50M SEK
        min_ebitda_margin=0.03,  # 3%
        min_growth=0.05,  # 5%
        max_results=10  # Just 10 companies for testing
    )
    
    print("\nTest Criteria:")
    print(f"  Min Revenue: {criteria.min_revenue:,.0f} SEK")
    print(f"  Min EBITDA Margin: {criteria.min_ebitda_margin:.1%}")
    print(f"  Min Growth: {criteria.min_growth:.1%}")
    print(f"  Max Results: {criteria.max_results}")
    
    # Test Stage 1 only first
    print("\n" + "-" * 60)
    print("Stage 1: Financial Filter")
    print("-" * 60)
    
    try:
        filter_engine = FinancialFilter()
        orgnrs = filter_engine.filter(criteria)
        print(f"✓ Found {len(orgnrs)} companies")
        if orgnrs:
            print(f"  Sample: {orgnrs[:3]}")
    except Exception as e:
        print(f"✗ Stage 1 failed: {e}")
        return
    
    # Run full workflow
    print("\n" + "-" * 60)
    print("Running Full Workflow (3 Stages)")
    print("-" * 60)
    
    try:
        workflow = AcquisitionWorkflow()
        result = await workflow.run(criteria, created_by="test_script")
        
        print(f"\n✓ Workflow completed!")
        print(f"  Run ID: {result.run_id}")
        print(f"  Status: {result.status}")
        print(f"  Stage 1: {result.stage1_count} companies filtered")
        print(f"  Stage 2: {result.stage2_count} companies researched")
        print(f"  Stage 3: {result.stage3_count} companies analyzed")
        print(f"  Duration: {result.started_at} -> {result.completed_at}")
        
        return result.run_id
        
    except Exception as e:
        print(f"\n✗ Workflow failed: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    run_id = asyncio.run(test_workflow())
    
    if run_id:
        print("\n" + "=" * 60)
        print("Test completed successfully!")
        print("=" * 60)
        print(f"\nTo view results, check:")
        print(f"  GET /api/acquisition/runs/{run_id}")
        print(f"  GET /api/acquisition/runs/{run_id}/companies")
    else:
        print("\n" + "=" * 60)
        print("Test failed!")
        print("=" * 60)
        sys.exit(1)
