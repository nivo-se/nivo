"""
Stage 2: Web Research & Enrichment

Scrapes company websites and searches for business intelligence.
"""

from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse

import aiohttp
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


@dataclass
class ResearchData:
    """Web research results for a company"""
    orgnr: str
    homepage_url: Optional[str] = None
    website_content: Optional[str] = None
    about_text: Optional[str] = None
    products_text: Optional[str] = None
    search_results: Dict = field(default_factory=dict)
    extracted_products: List[str] = field(default_factory=list)
    extracted_markets: List[str] = field(default_factory=list)
    sales_channels: List[str] = field(default_factory=list)
    digital_score: int = 0
    scrape_success: bool = False
    search_success: bool = False


class WebResearcher:
    """Researches companies via web scraping and search"""
    
    def __init__(self):
        self.serpapi_key = os.getenv("SERPAPI_KEY")
        self.timeout = aiohttp.ClientTimeout(total=10)
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }
    
    async def research_company(
        self, 
        orgnr: str, 
        company_name: str, 
        homepage: Optional[str]
    ) -> ResearchData:
        """
        Research a company by scraping website and searching
        
        Args:
            orgnr: Organization number
            company_name: Company name
            homepage: Homepage URL (if known)
            
        Returns:
            ResearchData with collected information
        """
        logger.info(f"Researching company: {company_name} ({orgnr})")
        
        research = ResearchData(orgnr=orgnr, homepage_url=homepage)
        
        # Run scraping and search in parallel
        tasks = []
        
        if homepage:
            tasks.append(self._scrape_website(homepage, research))
        
        if self.serpapi_key:
            tasks.append(self._search_company(company_name, research))
        else:
            logger.warning("SERPAPI_KEY not set, skipping search")
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        
        # Calculate digital score
        research.digital_score = self._calculate_digital_score(research)
        
        return research
    
    async def _scrape_website(self, url: str, research: ResearchData) -> None:
        """Scrape company website"""
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                # Scrape homepage
                async with session.get(url, headers=self.headers) as response:
                    if response.status == 200:
                        html = await response.text()
                        soup = BeautifulSoup(html, 'html.parser')
                        
                        # Extract main content
                        research.website_content = self._extract_text(soup)
                        
                        # Try to find About page
                        about_link = self._find_link(soup, url, ['about', 'om-oss', 'om oss'])
                        if about_link:
                            research.about_text = await self._scrape_page(session, about_link)
                        
                        # Try to find Products page
                        products_link = self._find_link(soup, url, ['products', 'produkter', 'tjanster', 'services'])
                        if products_link:
                            research.products_text = await self._scrape_page(session, products_link)
                        
                        research.scrape_success = True
                        logger.info(f"Successfully scraped {url}")
                    else:
                        logger.warning(f"Failed to scrape {url}: HTTP {response.status}")
                        
        except Exception as e:
            logger.error(f"Error scraping {url}: {e}")
    
    async def _scrape_page(self, session: aiohttp.ClientSession, url: str) -> Optional[str]:
        """Scrape a single page"""
        try:
            async with session.get(url, headers=self.headers) as response:
                if response.status == 200:
                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')
                    return self._extract_text(soup)
        except Exception as e:
            logger.debug(f"Failed to scrape {url}: {e}")
        return None
    
    def _find_link(self, soup: BeautifulSoup, base_url: str, keywords: List[str]) -> Optional[str]:
        """Find a link containing any of the keywords"""
        for link in soup.find_all('a', href=True):
            href = link['href'].lower()
            text = link.get_text().lower()
            
            if any(keyword in href or keyword in text for keyword in keywords):
                return urljoin(base_url, link['href'])
        return None
    
    def _extract_text(self, soup: BeautifulSoup) -> str:
        """Extract clean text from HTML"""
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.decompose()
        
        # Get text
        text = soup.get_text()
        
        # Clean up whitespace
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = ' '.join(chunk for chunk in chunks if chunk)
        
        # Limit length
        return text[:5000]
    
    async def _search_company(self, company_name: str, research: ResearchData) -> None:
        """Search for company information using SerpAPI"""
        if not self.serpapi_key:
            return
        
        queries = [
            f"{company_name} products services",
            f"{company_name} customers markets",
            f"{company_name} business model",
        ]
        
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                for query in queries:
                    params = {
                        "q": query,
                        "api_key": self.serpapi_key,
                        "num": 3,
                        "gl": "se",  # Sweden
                        "hl": "sv",  # Swedish
                    }
                    
                    async with session.get(
                        "https://serpapi.com/search",
                        params=params
                    ) as response:
                        if response.status == 200:
                            data = await response.json()
                            research.search_results[query] = data.get("organic_results", [])
                        else:
                            logger.warning(f"Search failed for '{query}': HTTP {response.status}")
                    
                    # Rate limit
                    await asyncio.sleep(0.5)
                
                research.search_success = True
                logger.info(f"Successfully searched for {company_name}")
                
        except Exception as e:
            logger.error(f"Error searching for {company_name}: {e}")
    
    def _calculate_digital_score(self, research: ResearchData) -> int:
        """Calculate digital presence score (0-100)"""
        score = 0
        
        # Has website
        if research.homepage_url:
            score += 20
        
        # Website content found
        if research.website_content:
            score += 20
        
        # Has dedicated About page
        if research.about_text:
            score += 15
        
        # Has dedicated Products page
        if research.products_text:
            score += 15
        
        # Search results found
        if research.search_results:
            score += 15
        
        # Scraping was successful
        if research.scrape_success:
            score += 10
        
        # Search was successful
        if research.search_success:
            score += 5
        
        return min(score, 100)


async def research_batch(
    companies: List[tuple[str, str, Optional[str]]],
    max_concurrent: int = 10
) -> List[ResearchData]:
    """
    Research multiple companies in parallel
    
    Args:
        companies: List of (orgnr, company_name, homepage) tuples
        max_concurrent: Maximum concurrent requests
        
    Returns:
        List of ResearchData results
    """
    researcher = WebResearcher()
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def research_with_limit(orgnr: str, name: str, homepage: Optional[str]):
        async with semaphore:
            return await researcher.research_company(orgnr, name, homepage)
    
    tasks = [
        research_with_limit(orgnr, name, homepage)
        for orgnr, name, homepage in companies
    ]
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Filter out exceptions
    return [r for r in results if isinstance(r, ResearchData)]
