"""
External data enrichment service for deep AI analysis.
Gathers public information from company websites, news, and industry sources.
"""

import asyncio
import json
import logging
import re
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlparse

import aiohttp
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


@dataclass
class CompanyWebsiteData:
    """Data extracted from company website."""
    about_text: Optional[str] = None
    products_services: List[str] = None
    recent_news: List[str] = None
    contact_info: Dict[str, str] = None
    social_media: Dict[str, str] = None
    
    def __post_init__(self):
        if self.products_services is None:
            self.products_services = []
        if self.recent_news is None:
            self.recent_news = []
        if self.contact_info is None:
            self.contact_info = {}
        if self.social_media is None:
            self.social_media = {}


@dataclass
class NewsArticle:
    """News article data."""
    title: str
    url: str
    published_date: Optional[str] = None
    summary: Optional[str] = None
    source: Optional[str] = None


@dataclass
class EnrichmentData:
    """Complete enrichment data for a company."""
    company_name: str
    orgnr: str
    website_data: Optional[CompanyWebsiteData] = None
    news_articles: List[NewsArticle] = None
    industry_context: Dict[str, Any] = None
    enrichment_timestamp: str = None
    
    def __post_init__(self):
        if self.news_articles is None:
            self.news_articles = []
        if self.industry_context is None:
            self.industry_context = {}
        if self.enrichment_timestamp is None:
            self.enrichment_timestamp = time.strftime('%Y-%m-%d %H:%M:%S')


class WebEnrichmentService:
    """Service for gathering external data about companies."""
    
    def __init__(self, timeout: int = 10, max_concurrent: int = 5):
        self.timeout = timeout
        self.max_concurrent = max_concurrent
        self.session: Optional[aiohttp.ClientSession] = None
        
    async def __aenter__(self):
        connector = aiohttp.TCPConnector(limit=self.max_concurrent)
        timeout = aiohttp.ClientTimeout(total=self.timeout)
        self.session = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers={
                'User-Agent': 'Mozilla/5.0 (compatible; NivoAI/1.0; +https://nivogroup.se)'
            }
        )
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def enrich_company(self, company_name: str, orgnr: str, homepage: Optional[str] = None) -> EnrichmentData:
        """Enrich a single company with external data."""
        enrichment_data = EnrichmentData(
            company_name=company_name,
            orgnr=orgnr
        )
        
        try:
            # Gather website data if homepage is available
            if homepage:
                enrichment_data.website_data = await self._scrape_website(homepage)
            
            # Search for news articles
            enrichment_data.news_articles = await self._search_news(company_name, orgnr)
            
            # Gather industry context
            enrichment_data.industry_context = await self._gather_industry_context(company_name)
            
        except Exception as e:
            logger.error(f"Error enriching company {company_name} ({orgnr}): {e}")
        
        return enrichment_data
    
    async def _scrape_website(self, url: str) -> Optional[CompanyWebsiteData]:
        """Scrape company website for relevant information."""
        try:
            if not self.session:
                return None
                
            async with self.session.get(url) as response:
                if response.status != 200:
                    return None
                    
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')
                
                website_data = CompanyWebsiteData()
                
                # Extract about text
                about_selectors = [
                    'section[class*="about"]',
                    'div[class*="about"]',
                    'section[id*="about"]',
                    'div[id*="about"]',
                    '.about-us',
                    '#about-us'
                ]
                
                for selector in about_selectors:
                    about_section = soup.select_one(selector)
                    if about_section:
                        website_data.about_text = about_section.get_text(strip=True)[:1000]
                        break
                
                # Extract products/services
                product_selectors = [
                    'section[class*="product"]',
                    'div[class*="service"]',
                    'section[class*="service"]',
                    '.products',
                    '.services'
                ]
                
                for selector in product_selectors:
                    product_section = soup.select_one(selector)
                    if product_section:
                        products = product_section.find_all(['h2', 'h3', 'li'])
                        website_data.products_services = [
                            p.get_text(strip=True) for p in products[:10]
                            if p.get_text(strip=True) and len(p.get_text(strip=True)) > 10
                        ]
                        break
                
                # Extract contact information
                contact_patterns = {
                    'email': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
                    'phone': r'(\+46|0)[\s-]?\d{2,3}[\s-]?\d{2,3}[\s-]?\d{2,3}',
                }
                
                page_text = soup.get_text()
                for info_type, pattern in contact_patterns.items():
                    matches = re.findall(pattern, page_text)
                    if matches:
                        website_data.contact_info[info_type] = matches[0]
                
                # Extract social media links
                social_links = soup.find_all('a', href=True)
                for link in social_links:
                    href = link['href']
                    if 'linkedin.com' in href:
                        website_data.social_media['linkedin'] = href
                    elif 'facebook.com' in href:
                        website_data.social_media['facebook'] = href
                    elif 'twitter.com' in href or 'x.com' in href:
                        website_data.social_media['twitter'] = href
                
                return website_data
                
        except Exception as e:
            logger.error(f"Error scraping website {url}: {e}")
            return None
    
    async def _search_news(self, company_name: str, orgnr: str) -> List[NewsArticle]:
        """Search for recent news articles about the company."""
        articles = []
        
        try:
            # Search terms
            search_terms = [
                f'"{company_name}"',
                f'"{company_name}" Sverige',
                f'"{company_name}" Sweden'
            ]
            
            # For now, we'll simulate news search since we don't have API keys
            # In a real implementation, you would use Google News API, NewsAPI, etc.
            articles = await self._simulate_news_search(company_name, search_terms)
            
        except Exception as e:
            logger.error(f"Error searching news for {company_name}: {e}")
        
        return articles
    
    async def _simulate_news_search(self, company_name: str, search_terms: List[str]) -> List[NewsArticle]:
        """Simulate news search (replace with real API calls)."""
        # This is a placeholder - in production, integrate with real news APIs
        return [
            NewsArticle(
                title=f"Recent development at {company_name}",
                url="https://example.com/news/1",
                published_date="2024-01-15",
                summary=f"Latest news about {company_name} operations",
                source="Industry News"
            )
        ]
    
    async def _gather_industry_context(self, company_name: str) -> Dict[str, Any]:
        """Gather industry context and trends."""
        # This is a placeholder for industry research
        # In production, you might integrate with industry databases, reports, etc.
        return {
            "industry_trends": [
                "Digital transformation accelerating",
                "Sustainability focus increasing",
                "Supply chain optimization"
            ],
            "market_size": "Medium",
            "growth_prospects": "Positive",
            "key_challenges": [
                "Talent acquisition",
                "Regulatory compliance",
                "Technology adoption"
            ]
        }


class EnrichmentDataFormatter:
    """Formats enrichment data for AI analysis."""
    
    @staticmethod
    def format_for_ai_analysis(enrichment_data: EnrichmentData) -> str:
        """Format enrichment data as text for AI analysis."""
        sections = []
        
        # Company overview
        sections.append(f"Company: {enrichment_data.company_name}")
        sections.append(f"Organization Number: {enrichment_data.orgnr}")
        sections.append("")
        
        # Website information
        if enrichment_data.website_data:
            sections.append("=== WEBSITE INFORMATION ===")
            
            if enrichment_data.website_data.about_text:
                sections.append(f"About: {enrichment_data.website_data.about_text}")
            
            if enrichment_data.website_data.products_services:
                sections.append("Products/Services:")
                for product in enrichment_data.website_data.products_services[:5]:
                    sections.append(f"  - {product}")
            
            if enrichment_data.website_data.contact_info:
                sections.append("Contact Information:")
                for key, value in enrichment_data.website_data.contact_info.items():
                    sections.append(f"  {key.title()}: {value}")
            
            sections.append("")
        
        # News articles
        if enrichment_data.news_articles:
            sections.append("=== RECENT NEWS ===")
            for article in enrichment_data.news_articles[:3]:
                sections.append(f"• {article.title}")
                if article.summary:
                    sections.append(f"  {article.summary}")
                if article.published_date:
                    sections.append(f"  Published: {article.published_date}")
            sections.append("")
        
        # Industry context
        if enrichment_data.industry_context:
            sections.append("=== INDUSTRY CONTEXT ===")
            
            if enrichment_data.industry_context.get("industry_trends"):
                sections.append("Industry Trends:")
                for trend in enrichment_data.industry_context["industry_trends"]:
                    sections.append(f"  - {trend}")
            
            if enrichment_data.industry_context.get("key_challenges"):
                sections.append("Key Challenges:")
                for challenge in enrichment_data.industry_context["key_challenges"]:
                    sections.append(f"  - {challenge}")
            
            sections.append("")
        
        return "\n".join(sections)


async def enrich_companies_for_analysis(companies: List[Dict[str, Any]]) -> Dict[str, EnrichmentData]:
    """Enrich multiple companies for AI analysis."""
    enrichment_results = {}
    
    async with WebEnrichmentService() as enrichment_service:
        tasks = []
        
        for company in companies:
            company_name = company.get('name', 'Unknown')
            orgnr = company.get('orgnr', '')
            homepage = company.get('homepage')
            
            task = enrichment_service.enrich_company(company_name, orgnr, homepage)
            tasks.append((orgnr, task))
        
        # Execute enrichment tasks
        for orgnr, task in tasks:
            try:
                enrichment_data = await task
                enrichment_results[orgnr] = enrichment_data
            except Exception as e:
                logger.error(f"Failed to enrich company {orgnr}: {e}")
    
    return enrichment_results


# Example usage
if __name__ == "__main__":
    async def main():
        companies = [
            {
                'name': 'Example Company AB',
                'orgnr': '556123-4567',
                'homepage': 'https://example.com'
            }
        ]
        
        results = await enrich_companies_for_analysis(companies)
        
        for orgnr, enrichment_data in results.items():
            formatted = EnrichmentDataFormatter.format_for_ai_analysis(enrichment_data)
            print(f"Enrichment data for {orgnr}:")
            print(formatted)
            print("-" * 50)
    
    asyncio.run(main())
