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
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
            viewport={"width": 390, "height": 844}
        )
        page = await context.new_page()
        
        print(f"Navigating to {url}")
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(8000)
        
        # Scroll to load all events
        for _ in range(5):
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await page.wait_for_timeout(2000)
        
        # Extract event links with their surrounding text
        raw_events = await page.evaluate("""
            () => {
                const links = document.querySelectorAll('a[href*="/events/"]');
                const seen = new Set();
                const results = [];
                for (const link of links) {
                    const href = link.href.split('?')[0];
                    if (seen.has(href)) continue;
                    seen.add(href);
                    // Get the link text and surrounding context
                    const text = link.textContent.trim();
                    // Walk up to find a parent with substantial text
                    let parent = link.parentElement;
                    let context = '';
                    for (let i = 0; i < 5 && parent; i++) {
                        const pt = parent.textContent.trim();
                        if (pt.length > context.length && pt.length < 2000) {
                            context = pt;
                        }
                        parent = parent.parentElement;
                    }
                    results.push({ href, text, context: context || text });
                }
                return results;
            }
        """)
        
        html = await page.content()
        await browser.close()
    
    print(f"Found {len(raw_events)} event links")
    
    # Parse each event link
    for raw in raw_events:
        href = raw['href']
        if '/events/' not in href:
            continue
            
        # Clean URL
        href = href.split('?')[0].replace('m.facebook.com', 'www.facebook.com')
        
        context_text = raw['context'] or raw['text'] or ''
        
        # Try to find a date pattern in the text
        # Facebook formats like: "Fri, Jun 5 at 6:00 PM EDT" or "Fri, Jul 24 at 7:00 PM EDT"
        date_match = re.search(
            r'(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+at\s+\d{1,2}:\d{2}\s*[AP]M\s*(?:EDT|EST|ET)?',
            context_text, re.IGNORECASE
        )
        
        # Also try without "at" and time
        if not date_match:
            date_match = re.search(
                r'(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}',
                context_text, re.IGNORECASE
            )
        
        parsed_date = None
        date_str = "TBD"
        if date_match:
            date_str = date_match.group(0)
            dp = dateparser.parse(date_str, settings={'TIMEZONE': 'US/Eastern', 'RETURN_AS_TIMEZONE_AWARE': False, 'PREFER_DATES_FROM': 'future'})
            if dp:
                parsed_date = dp
        
        # Extract title - look for text after the date
        title = "Cracked Sky Show"
        venue = ""
        location = ""
        
        # Split context into lines/parts
        parts = [p.strip() for p in re.split(r'[\n|·]', context_text) if p.strip() and len(p.strip()) > 2]
        
        # Remove date part from consideration
        other_parts = [p for p in parts if not re.match(r'^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)', p, re.IGNORECASE) 
                       and 'interested' not in p.lower() 
                       and 'people' not in p.lower()
                       and 'event by' not in p.lower()
                       and p != date_str]
        
        if other_parts:
            # First non-date part is usually the title
            title = other_parts[0]
        if len(other_parts) > 1:
            # Second is usually venue
            venue = other_parts[1]
            # Try to extract location from venue text (e.g., "CJ Finz Raw Bar & Grille · Manassas")
            loc_match = re.search(r'[·,]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})', venue)
            if loc_match:
                location = loc_match.group(1).strip()
                venue = venue.split('·')[0].split(',')[0].strip() if '·' in venue or ',' in venue else venue
        
        if parsed_date or date_str != "TBD":
            events.append({
                "date": date_str,
                "parsedDate": parsed_date.isoformat() + "Z" if parsed_date else "",
                "title": title,
                "venue": venue,
                "location": location,
                "url": href
            })
            print(f"  Parsed: {date_str} | {title} | {venue}")
        else:
            print(f"  Skipped (no date found): {context_text[:80]}")
    
    if not events:
        print("Warning: No events found during scrape.")
        
    return events

async def main():
    url = "https://m.facebook.com/CrackedSkyRockBand/events"
    events = await scrape_facebook_events(url)
    
    events_file = os.path.join(os.path.dirname(__file__), '..', 'events.json')
    
    existing_events = []
    if os.path.exists(events_file):
        with open(events_file, 'r', encoding='utf-8') as f:
            try:
                existing_events = json.load(f)
            except json.JSONDecodeError:
                pass
                
    if events:
        print(f"Found {len(events)} events. Updating events.json")
        with open(events_file, 'w', encoding='utf-8') as f:
            json.dump(events, f, indent=2, ensure_ascii=False)
    else:
        print("No events found. Keeping existing events.json unchanged.")

if __name__ == "__main__":
    asyncio.run(main())