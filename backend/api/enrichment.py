from __future__ import annotations

import logging
import os
from typing import List, Optional

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

from ..analysis.stage2_research import research_batch, ResearchData
from ..services.db_factory import get_database_service
from openai import AsyncOpenAI
import json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/enrichment", tags=["enrichment"])

class EnrichmentRequest(BaseModel):
    orgnrs: List[str]

class EnrichmentResponse(BaseModel):
    message: str
    job_id: str

async def process_enrichment(orgnrs: List[str]):
    """
    Background task to run enrichment pipeline
    """
    logger.info(f"Starting enrichment for {len(orgnrs)} companies")
    db = get_database_service()
    
    # 1. Fetch company details from DB
    placeholders = ','.join('?' * len(orgnrs))
    sql = f"SELECT orgnr, company_name, homepage FROM companies WHERE orgnr IN ({placeholders})"
    rows = db.run_raw_query(sql, params=orgnrs)
    
    companies_to_research = [
        (row['orgnr'], row['company_name'], row['homepage']) 
        for row in rows
    ]
    
    # 2. Run Web Research (Scraping + Search)
    research_results = await research_batch(companies_to_research)
    
    # 3. AI Summarization & Storage
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    for result in research_results:
        try:
            # Generate Summary
            summary = await generate_ai_summary(client, result)
            
            # Store in DB (company_research table)
            # Note: We are using SQLite, so we need to serialize JSON fields
            
            # Prepare data for SQL
            search_results_json = json.dumps(result.search_results)
            extracted_products_json = json.dumps(result.extracted_products)
            extracted_markets_json = json.dumps(result.extracted_markets)
            sales_channels_json = json.dumps(result.sales_channels)
            
            # Upsert into company_research (Local SQLite)
            sql = """
            INSERT OR REPLACE INTO company_research (
                orgnr, homepage_url, website_content, about_text, products_text,
                search_results, extracted_products, extracted_markets, sales_channels,
                digital_score, scrape_success, search_success, researched_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """
            
            db.run_raw_query(sql, params=[
                result.orgnr, result.homepage_url, result.website_content, result.about_text, result.products_text,
                search_results_json, extracted_products_json, extracted_markets_json, sales_channels_json,
                result.digital_score, result.scrape_success, result.search_success
            ])
            
            # Store in Supabase ai_profiles (as requested)
            try:
                from .dependencies import get_supabase_client
                supabase = get_supabase_client()
                
                profile_data = {
                    "org_number": result.orgnr,
                    "website": result.homepage_url,
                    "product_description": ", ".join(result.extracted_products) if result.extracted_products else None,
                    "end_market": ", ".join(result.extracted_markets) if result.extracted_markets else None,
                    "customer_types": ", ".join(result.sales_channels) if result.sales_channels else None,
                    "ai_notes": f"Enriched via web scraping. Digital score: {result.digital_score}",
                    "last_updated": "now()"
                }
                
                supabase.table("ai_profiles").upsert(profile_data, on_conflict="org_number").execute()
                logger.info(f"Synced enrichment to Supabase for {result.orgnr}")
                
            except Exception as sup_err:
                logger.error(f"Failed to sync to Supabase: {sup_err}")
            
            logger.info(f"Enriched {result.orgnr}")
            
        except Exception as e:
            logger.error(f"Error processing enrichment for {result.orgnr}: {e}")

async def generate_ai_summary(client: AsyncOpenAI, data: ResearchData) -> dict:
    """
    Generate AI summary from research data
    """
    prompt = f"""
    Analyze this company based on the scraped data:
    
    Website Content: {data.website_content[:2000] if data.website_content else 'N/A'}
    About Page: {data.about_text[:1000] if data.about_text else 'N/A'}
    Products Page: {data.products_text[:1000] if data.products_text else 'N/A'}
    Search Results: {json.dumps(data.search_results)[:1000] if data.search_results else 'N/A'}
    
    Task:
    Extract the following in JSON format:
    1. products: List of main products/services
    2. markets: Target markets/industries
    3. sales_channels: ["B2B", "B2C", "B2G"] (select applicable)
    4. summary: A short 2-sentence strategic summary of what they do.
    """
    
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        
        content = json.loads(response.choices[0].message.content)
        
        # Update research object
        data.extracted_products = content.get("products", [])
        data.extracted_markets = content.get("markets", [])
        data.sales_channels = content.get("sales_channels", [])
        # We could store 'summary' somewhere, but ResearchData doesn't have a field for it yet.
        # Let's just return it.
        return content
        
    except Exception as e:
        logger.error(f"AI Summary failed: {e}")
        return {}

@router.post("/start", response_model=EnrichmentResponse)
async def start_enrichment(request: EnrichmentRequest, background_tasks: BackgroundTasks):
    """
    Start enrichment process for a list of companies
    """
    # Run in background
    background_tasks.add_task(process_enrichment, request.orgnrs)
    
    return EnrichmentResponse(
        message=f"Started enrichment for {len(request.orgnrs)} companies",
        job_id="background_task" # Placeholder
    )
