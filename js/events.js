/* =============================================
   DYNAMIC EVENTS FETCHER
   ============================================= */
function loadEvents() {
    const eventsContainer = document.getElementById('events-fallback');
    if (!eventsContainer) return;

    const baseUrl = window.location.origin;
    fetch(baseUrl + '/events.json?v=' + Date.now())
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
                let d = new Date(event.parsedDate || event.date || event.dateString);
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

            // If 10+ events, use month tabs
            if (validEvents.length >= 10) {
                renderWithMonthTabs(eventsContainer, validEvents);
            } else {
                renderFlatList(eventsContainer, validEvents);
            }
        })
        .catch(error => {
            console.error('Error loading events:', error);
            eventsContainer.innerHTML = '<p class="no-events" style="text-align: center;">Error loading shows. Please check our Facebook page.</p>';
        });
}

function renderEventCard(event) {
    const item = document.createElement('article');
    item.className = 'show-row reveal';
    item.setAttribute('role', 'listitem');
    
    let monthYearStr = "TBD";
    let dayStr = "";
    let timeStr = "";
    
    if (!isNaN(event.parsedDate.getTime())) {
        const month = event.parsedDate.toLocaleString('default', { month: 'short' });
        const year = event.parsedDate.getFullYear();
        monthYearStr = `${month} ${year}`;
        dayStr = event.parsedDate.getDate().toString().padStart(2, '0');
        
        const timeMatch = (event.date || event.dateString || '').match(/at\s+(.+)$/i);
        if (timeMatch) {
            timeStr = timeMatch[1];
        }
    }

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
    return item;
}

function renderFlatList(container, events) {
    container.innerHTML = '';
    events.forEach((event, index) => {
        const item = renderEventCard(event);
        const delayClass = 'd' + ((index % 4) + 1);
        item.classList.add(delayClass);
        container.appendChild(item);
    });
    if (typeof initReveal === 'function') initReveal();
    else document.querySelectorAll('.show-row.reveal').forEach(el => el.classList.add('active'));
}

function renderWithMonthTabs(container, events) {
    // Group by month
    const grouped = {};
    events.forEach(e => {
        let monthKey = "Upcoming";
        if (!isNaN(e.parsedDate.getTime())) {
            monthKey = e.parsedDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        }
        if (!grouped[monthKey]) grouped[monthKey] = [];
        grouped[monthKey].push(e);
    });

    const months = Object.keys(grouped);

    container.innerHTML = '';
    container.style.display = 'block';
    
    const tabsDiv = document.createElement('div');
    tabsDiv.className = 'event-months-tabs';
    container.appendChild(tabsDiv);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'event-months-content';
    container.appendChild(contentDiv);

    function renderMonth(month) {
        Array.from(tabsDiv.children).forEach(btn => {
            btn.classList.toggle('active', btn.dataset.month === month);
        });
        
        contentDiv.innerHTML = '';
        grouped[month].forEach(event => {
            contentDiv.appendChild(renderEventCard(event));
        });
        if (typeof initReveal === 'function') initReveal();
        else document.querySelectorAll('.show-row.reveal').forEach(el => el.classList.add('active'));
    }

    months.forEach(month => {
        const btn = document.createElement('button');
        btn.className = 'month-tab-btn';
        btn.dataset.month = month;
        btn.innerText = month;
        btn.addEventListener('click', () => renderMonth(month));
        tabsDiv.appendChild(btn);
    });

    // Inject tab styles (idempotent)
    if (!document.getElementById('cs-month-tab-styles')) {
        const style = document.createElement('style');
        style.id = 'cs-month-tab-styles';
        style.textContent = `
            .event-months-tabs { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
            .month-tab-btn { 
                background: transparent; 
                border: 1px solid #c8a250; 
                color: #ede0bf; 
                padding: 6px 14px; 
                cursor: pointer; 
                font-family: inherit; 
                font-size: 0.85rem;
                letter-spacing: 0.04em;
                border-radius: 4px; 
                transition: 0.2s; 
                display: inline-flex;
                align-items: center;
                justify-content: center;
                height: auto;
                min-height: 0;
                flex: 0 0 auto;
                width: auto;
                line-height: 1.2;
                white-space: nowrap;
            }
            .month-tab-btn:hover { background: rgba(200,162,80,0.2); }
            .month-tab-btn.active { 
                background: #c8a250; 
                color: #111; 
                font-weight: 600;
            }
            .event-months-content {
                display: grid;
                grid-template-columns: 1fr;
                gap: 0.7rem;
            }
        `;
        document.head.appendChild(style);
    }

    if (months.length > 0) renderMonth(months[0]);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadEvents);
} else {
    loadEvents();
}