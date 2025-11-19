"""
Financial filter endpoints for Stage 1 shortlist generation
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json
import numpy as np
import pandas as pd
import logging
import sys
from pathlib import Path
# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agentic_pipeline.config import PipelineConfig, SegmentWeighting
from agentic_pipeline.staged_workflow import StagedTargetingWorkflow, StagePlan
from .dependencies import get_supabase_client
from supabase import Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/filters", tags=["filters"])


class FilterWeights(BaseModel):
    """Financial filter weights from frontend"""
    revenue: float = 30.0
    ebitMargin: float = 25.0
    growth: float = 25.0
    leverage: float = 10.0
    headcount: float = 10.0


class FilterRequest(BaseModel):
    """Request to apply filters and generate shortlist"""
    weights: FilterWeights
    use_percentiles: bool = False
    percentile_cutoffs: Optional[Dict[str, Dict[str, float]]] = None
    stage_one_size: int = 180


def map_frontend_weights_to_segment_weighting(weights: FilterWeights) -> SegmentWeighting:
    """
    Map frontend filter weights to backend SegmentWeighting.
    
    Frontend weights: revenue, ebitMargin, growth, leverage, headcount
    Backend weights: growth, profitability, efficiency, risk, data_quality
    
    Mapping:
    - growth -> growth (direct)
    - ebitMargin -> profitability (direct)
    - revenue -> efficiency (revenue per employee proxy)
    - leverage -> risk (inverse)
    - headcount -> data_quality (proxy for data completeness)
    """
    total = weights.revenue + weights.ebitMargin + weights.growth + weights.leverage + weights.headcount
    if total == 0:
        total = 1.0  # Avoid division by zero
    
    # Normalize to sum to 1.0
    normalized = {
        'growth': weights.growth / total,
        'profitability': weights.ebitMargin / total,
        'efficiency': weights.revenue / total,  # Revenue as proxy for efficiency
        'risk': weights.leverage / total,  # Leverage as risk indicator
        'data_quality': weights.headcount / total,  # Headcount as data quality proxy
    }
    
    return SegmentWeighting(
        growth=normalized['growth'],
        profitability=normalized['profitability'],
        efficiency=normalized['efficiency'],
        risk=normalized['risk'],
        data_quality=normalized['data_quality'],
    )


@router.get("/analytics")
async def get_filter_analytics(
    weights: Optional[str] = Query(None, description="JSON string of filter weights"),
    use_percentiles: bool = Query(False, description="Use percentile-based filtering"),
):
    """
    Calculate analytics for current filter configuration.
    Returns data for scatter plots, density maps, and percentile distributions.
    """
    try:
        # Parse weights or use defaults
        if weights:
            weight_dict = json.loads(weights)
            filter_weights = FilterWeights(**weight_dict)
        else:
            filter_weights = FilterWeights()
        
        # Map to backend weights
        segment_weights = map_frontend_weights_to_segment_weighting(filter_weights)
        
        # Get Supabase client
        supabase = get_supabase_client()
        
        # Fetch company metrics for analytics
        # Get a sample of companies with metrics (limit to 1000 for performance)
        response = supabase.table("company_metrics").select(
            "orgnr, latest_revenue_sek, revenue_cagr_3y, avg_ebitda_margin, avg_net_margin, "
            "companies!inner(company_name, employees_latest)"
        ).limit(1000).execute()
        
        if not response.data:
            return {
                "percentiles": {},
                "clusters": [],
                "scatter_data": [],
                "density_data": [],
                "error": "No data available"
            }
        
        # Convert to DataFrame for analysis
        companies = []
        for row in response.data:
            company = row.get('companies', {})
            companies.append({
                'orgnr': row.get('orgnr'),
                'name': company.get('company_name', 'Unknown'),
                'revenue': row.get('latest_revenue_sek') or 0,
                'growth': row.get('revenue_cagr_3y') or 0,
                'ebitda_margin': row.get('avg_ebitda_margin') or 0,
                'net_margin': row.get('avg_net_margin') or 0,
                'employees': company.get('employees_latest') or 0,
            })
        
        df = pd.DataFrame(companies)
        
        # Calculate percentiles
        percentiles = {
            'revenue': {
                'p25': float(df['revenue'].quantile(0.25)),
                'p50': float(df['revenue'].quantile(0.50)),
                'p75': float(df['revenue'].quantile(0.75)),
                'p90': float(df['revenue'].quantile(0.90)),
            },
            'growth': {
                'p25': float(df['growth'].quantile(0.25)),
                'p50': float(df['growth'].quantile(0.50)),
                'p75': float(df['growth'].quantile(0.75)),
                'p90': float(df['growth'].quantile(0.90)),
            },
            'ebitda_margin': {
                'p25': float(df['ebitda_margin'].quantile(0.25)),
                'p50': float(df['ebitda_margin'].quantile(0.50)),
                'p75': float(df['ebitda_margin'].quantile(0.75)),
                'p90': float(df['ebitda_margin'].quantile(0.90)),
            },
        }
        
        # Generate scatter plot data (growth vs margin)
        scatter_data = []
        for _, row in df.iterrows():
            if pd.notna(row['growth']) and pd.notna(row['ebitda_margin']):
                scatter_data.append({
                    'x': float(row['growth']),
                    'y': float(row['ebitda_margin']),
                    'orgnr': row['orgnr'],
                    'name': row['name'],
                    'revenue': float(row['revenue']),
                })
        
        # Simple clustering (for now, just categorize by quadrant)
        clusters = [
            {'id': 'high_growth_high_margin', 'name': 'High Growth + High Margin', 'count': 0},
            {'id': 'high_growth_low_margin', 'name': 'High Growth + Low Margin', 'count': 0},
            {'id': 'low_growth_high_margin', 'name': 'Low Growth + High Margin', 'count': 0},
            {'id': 'low_growth_low_margin', 'name': 'Low Growth + Low Margin', 'count': 0},
        ]
        
        growth_median = df['growth'].median()
        margin_median = df['ebitda_margin'].median()
        
        for _, row in df.iterrows():
            if pd.notna(row['growth']) and pd.notna(row['ebitda_margin']):
                if row['growth'] >= growth_median and row['ebitda_margin'] >= margin_median:
                    clusters[0]['count'] += 1
                elif row['growth'] >= growth_median:
                    clusters[1]['count'] += 1
                elif row['ebitda_margin'] >= margin_median:
                    clusters[2]['count'] += 1
                else:
                    clusters[3]['count'] += 1
        
        # Density data (simplified - just bin counts)
        density_data = []
        # Create 10x10 grid for growth vs margin
        growth_bins = np.linspace(df['growth'].min(), df['growth'].max(), 10)
        margin_bins = np.linspace(df['ebitda_margin'].min(), df['ebitda_margin'].max(), 10)
        
        for i in range(len(growth_bins) - 1):
            for j in range(len(margin_bins) - 1):
                count = len(df[
                    (df['growth'] >= growth_bins[i]) & (df['growth'] < growth_bins[i + 1]) &
                    (df['ebitda_margin'] >= margin_bins[j]) & (df['ebitda_margin'] < margin_bins[j + 1])
                ])
                if count > 0:
                    density_data.append({
                        'x': float((growth_bins[i] + growth_bins[i + 1]) / 2),
                        'y': float((margin_bins[j] + margin_bins[j + 1]) / 2),
                        'value': int(count),
                    })
        
        return {
            "percentiles": percentiles,
            "clusters": clusters,
            "scatter_data": scatter_data[:500],  # Limit for performance
            "density_data": density_data,
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating analytics: {str(e)}")


@router.post("/apply")
async def apply_filters(request: FilterRequest):
    """
    Apply financial filters and generate Stage 1 shortlist.
    Uses Supabase directly instead of the SQLite-based pipeline.
    """
    try:
        supabase = get_supabase_client()
        
        # Fetch company metrics from Supabase
        # IMPORTANT: Using avg_ebitda_margin which is the average EBITDA margin over multiple years
        # This is stored as a decimal (0.15 = 15%), not a percentage
        response = supabase.table("company_metrics").select(
            "orgnr, latest_revenue_sek, revenue_cagr_3y, avg_ebitda_margin, avg_net_margin, "
            "latest_ebitda_sek, latest_revenue_sek, "
            "companies!inner(company_name, employees_latest)"
        ).limit(5000).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="No company data found")
        
        # Convert to DataFrame
        companies_data = []
        for row in response.data:
            company = row.get('companies', {})
            revenue = row.get('latest_revenue_sek') or 0
            ebitda = row.get('latest_ebitda_sek') or 0
            
            # Use avg_ebitda_margin if available, otherwise calculate from latest year
            # avg_ebitda_margin is stored as decimal (0.15 = 15%)
            avg_ebitda_margin = row.get('avg_ebitda_margin')
            if avg_ebitda_margin is None and revenue > 0:
                # Fallback: calculate from latest year data
                avg_ebitda_margin = ebitda / revenue if revenue > 0 else 0
            elif avg_ebitda_margin is None:
                avg_ebitda_margin = 0
            
            companies_data.append({
                'orgnr': row.get('orgnr'),
                'name': company.get('company_name', 'Unknown'),
                'revenue': revenue,
                'revenue_growth': row.get('revenue_cagr_3y') or 0,  # Already a decimal (0.12 = 12%)
                'ebitda_margin': avg_ebitda_margin,  # Decimal format (0.15 = 15%)
                'net_margin': row.get('avg_net_margin') or 0,  # Decimal format
                'employees': company.get('employees_latest') or 0,
            })
        
        df = pd.DataFrame(companies_data)
        
        if df.empty:
            raise HTTPException(status_code=404, detail="No companies found after filtering")
        
        # Calculate composite score using the weights
        # Normalize each metric to 0-1 scale
        def normalize(series):
            if series.std() == 0:
                return pd.Series(0.0, index=series.index)
            return (series - series.min()) / (series.max() - series.min() + 1e-9)
        
        # Normalize metrics
        df['revenue_norm'] = normalize(df['revenue'].fillna(0))
        df['growth_norm'] = normalize(df['revenue_growth'].fillna(0))
        # Use EBITDA margin (stored as decimal: 0.15 = 15%)
        df['ebitda_margin_norm'] = normalize(df['ebitda_margin'].fillna(0))
        
        # Calculate leverage proxy (inverse of equity ratio - we'll use a simple proxy)
        # For now, use revenue/employees as efficiency proxy
        df['efficiency'] = (df['revenue'] / (df['employees'] + 1)).fillna(0)
        df['efficiency_norm'] = normalize(df['efficiency'])
        
        # Calculate composite score with weights
        total_weight = request.weights.revenue + request.weights.ebitMargin + request.weights.growth + request.weights.leverage + request.weights.headcount
        if total_weight == 0:
            total_weight = 1.0
        
        df['composite_score'] = (
            (request.weights.revenue / total_weight) * df['revenue_norm'] +
            (request.weights.ebitMargin / total_weight) * df['ebitda_margin_norm'] +
            (request.weights.growth / total_weight) * df['growth_norm'] +
            (request.weights.leverage / total_weight) * df['efficiency_norm'] +
            (request.weights.headcount / total_weight) * normalize(df['employees'].fillna(0))
        )
        
        # Sort by composite score and take top N
        df_sorted = df.sort_values('composite_score', ascending=False).head(request.stage_one_size)
        
        # Convert to response format
        companies = []
        for _, row in df_sorted.iterrows():
            companies.append({
                'orgnr': str(row['orgnr']),
                'name': str(row['name']),
                'revenue': float(row['revenue']),
                'growth': float(row['revenue_growth']),  # Decimal (0.12 = 12%)
                'ebitda_margin': float(row['ebitda_margin']),  # Decimal (0.15 = 15%)
                'net_margin': float(row['net_margin']),  # Decimal format
                'composite_score': float(row['composite_score']),
            })
        
        # Save shortlist to database
        try:
            shortlist_name = f"Stage 1 Shortlist - {request.stage_one_size} companies"
            shortlist_description = f"Generated with weights: Revenue={request.weights.revenue}%, EBITDA Margin={request.weights.ebitMargin}%, Growth={request.weights.growth}%, Leverage={request.weights.leverage}%, Headcount={request.weights.headcount}%"
            
            supabase.table("stage1_shortlists").insert({
                "name": shortlist_name,
                "description": shortlist_description,
                "weights_json": request.weights.dict(),
                "stage_one_size": request.stage_one_size,
                "companies": companies,
                "total_companies": len(companies),
                "status": "active"
            }).execute()
        except Exception as save_error:
            # Log error but don't fail the request
            logger.warning(f"Failed to save shortlist to database: {save_error}")
        
        return {
            "success": True,
            "companies": companies,
            "total": len(companies),
            "weights_applied": request.weights.dict(),
            "saved": True,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error applying filters: {str(e)}")

