import asyncio
import json
import os
import re
from datetime import datetime
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright
import dateparser

async def scrape_facebook_events(url):
    events = []
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Using a mobile user-agent often yields simpler HTML on Facebook
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
            viewport={"width": 390, "height": 844}
        )
        page = await context.new_page()
        
        print(f"Navigating to {url}")
        # Try to go to the page
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        
        # Wait for potential events to load
        await page.wait_for_timeout(8000)
        
        # Try to scroll a bit to trigger lazy loading
        for _ in range(3):
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await page.wait_for_timeout(2000)
            
        html = await page.content()
        await browser.close()
        
    print(f"Loaded HTML length: {len(html)}")
    soup = BeautifulSoup(html, 'html.parser')
    
    # Facebook's DOM is highly obfuscated. We look for links containing '/events/'
    # On mobile, events are often structured differently.
    event_links = soup.find_all('a', href=re.compile(r'/events/\d+'))
    
    seen_urls = set()
    
    for link in event_links:
        href = link.get('href', '')
        if href.startswith('/'):
            href = "https://m.facebook.com" + href
            
        # Clean up URL (remove tracking params)
        href = href.split('?')[0]
        
        if href in seen_urls:
            continue
            
        # Get parent containers to find text
        parent = link.find_parent('div')
        text_content = ""
        if parent:
            text_content = parent.get_text(separator=' | ', strip=True)
        else:
            text_content = link.get_text(separator=' | ', strip=True)
            
        if not text_content or len(text_content) < 10:
            continue
            
        # Heuristic parsing: look for typical event text
        # Example text: "FRI, JUN 5 AT 6 PM | Cracked Sky @ CJ Finz | CJ Finz Raw Bar & Grille"
        
        parts = [p.strip() for p in text_content.split('|') if p.strip()]
        
        # This is highly dependent on FB's exact rendering. 
        # We will attempt to parse dates from the first few parts.
        parsed_date = None
        date_str = "TBD"
        title = "Cracked Sky Show"
        venue = ""
        
        for part in parts:
            # Check if it looks like a date/time
            dp = dateparser.parse(part, settings={'TIMEZONE': 'US/Eastern', 'RETURN_AS_TIMEZONE_AWARE': False})
            if dp and not parsed_date:
                parsed_date = dp
                date_str = part
                break
                
        # If we found a date, try to get title and venue from other parts
        if parsed_date:
            other_parts = [p for p in parts if p != date_str and "people" not in p.lower() and "interested" not in p.lower()]
            if len(other_parts) >= 1:
                title = other_parts[0]
            if len(other_parts) >= 2:
                venue = other_parts[1]
                
            seen_urls.add(href)
            events.append({
                "date": date_str,
                "parsedDate": parsed_date.isoformat() + "Z", # naive UTC representation for JS compat
                "title": title,
                "venue": venue,
                "location": "", # Could be extracted if available
                "url": href.replace('m.facebook.com', 'www.facebook.com')
            })
            
    # Fallback to existing events if scrape failed or found nothing
    # so we don't accidentally overwrite good data with empty data
    if not events:
        print("Warning: No events found during scrape. FB might have blocked or changed structure.")
        
    return events

async def main():
    url = "https://m.facebook.com/CrackedSkyRockBand/events"
    events = await scrape_facebook_events(url)
    
    events_file = os.path.join(os.path.dirname(__file__), '..', 'events.json')
    
    # Load existing to not overwrite with empty if scrape fails completely
    existing_events = []
    if os.path.exists(events_file):
        with open(events_file, 'r', encoding='utf-8') as f:
            try:
                existing_events = json.load(f)
            except json.JSONDecodeError:
                pass
                
    if events:
        print(f"Found {len(events)} events. Updating {events_file}")
        with open(events_file, 'w', encoding='utf-8') as f:
            json.dump(events, f, indent=2, ensure_ascii=False)
    else:
        print("No events found. Not modifying events.json to be safe.")

if __name__ == "__main__":
    asyncio.run(main())