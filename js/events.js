/* =============================================
   DYNAMIC EVENTS FETCHER
   ============================================= */
function loadEvents() {
    const eventsContainer = document.getElementById('events-fallback');
    if (!eventsContainer) return;

    fetch('events.json?v=' + Date.now())
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(events => {
            if (!events || events.length === 0) {
                eventsContainer.innerHTML = '<p class="no-events" style="text-align: center;">No upcoming shows currently scheduled. Check back soon!</p>';
                return;
            }

            const now = new Date();
            now.setHours(0, 0, 0, 0);

            // Filter and sort events
            const validEvents = events.map(event => {
                let d = new Date(event.parsedDate || event.date);
                return { ...event, parsedDate: d };
            }).filter(e => {
                if (isNaN(e.parsedDate.getTime())) return true;
                return e.parsedDate >= now;
            }).sort((a, b) => {
                if (isNaN(a.parsedDate) || isNaN(b.parsedDate)) return 0;
                return a.parsedDate - b.parsedDate;
            });

            if (validEvents.length === 0) {
                eventsContainer.innerHTML = '<p class="no-events" style="text-align: center;">No upcoming shows currently scheduled. Check back soon!</p>';
                return;
            }

            // Render UI
            eventsContainer.innerHTML = '';
            
            validEvents.forEach((event, index) => {
                const item = document.createElement('article');
                // Alternating delay classes if they exist in CSS (e.g., d1, d2, d3, d4)
                const delayClass = 'd' + ((index % 4) + 1);
                item.className = `show-row reveal ${delayClass}`;
                item.setAttribute('role', 'listitem');
                
                let monthYearStr = "TBD";
                let dayStr = "";
                let timeStr = "";
                
                if (!isNaN(event.parsedDate.getTime())) {
                    const month = event.parsedDate.toLocaleString('default', { month: 'short' });
                    const year = event.parsedDate.getFullYear();
                    monthYearStr = `${month} ${year}`;
                    dayStr = event.parsedDate.getDate().toString().padStart(2, '0');
                    
                    // Try to parse time from the date string
                    const timeMatch = event.date.match(/at\s+(.+)$/i);
                    if (timeMatch) {
                        timeStr = timeMatch[1];
                    }
                }

                // If there's a specific title that describes the set
                let extraTitleInfo = "";
                if (event.title && !event.title.toLowerCase().includes("cracked sky")) {
                    extraTitleInfo = event.title;
                }
                
                let metaItems = [];
                if (extraTitleInfo) metaItems.push(extraTitleInfo);
                if (timeStr) metaItems.push(timeStr);
                if (event.location) metaItems.push(event.location);
                const metaLine = metaItems.join(' · ');

                item.innerHTML = `
                    <div class="show-date">
                        ${dayStr}
                        <span class="show-date-month">${monthYearStr}</span>
                    </div>
                    <div class="show-details">
                        <span class="show-venue">${event.venue || event.title}</span>
                        <span class="show-meta">${metaLine}</span>
                    </div>
                    <div class="show-cta">
                        <a href="${event.url}" target="_blank" rel="noopener noreferrer" class="btn-show" aria-label="Details for ${event.venue || 'show'}">Details</a>
                    </div>
                `;
                eventsContainer.appendChild(item);
            });
            
            // Re-trigger scroll reveal for new elements if main.js exposes a global function
            if (typeof initReveal === 'function') {
                initReveal(); // assuming there's an init function.
            } else {
                // If it's IntersectionObserver, just make them visible if there is no setup function.
                document.querySelectorAll('.show-row.reveal').forEach(el => el.classList.add('active'));
            }
        })
        .catch(error => {
            console.error('Error loading events:', error);
            eventsContainer.innerHTML = '<p class="no-events" style="text-align: center;">Error loading shows. Please check our Facebook page.</p>';
        });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadEvents);
} else {
    loadEvents();
}