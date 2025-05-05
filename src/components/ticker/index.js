export function initTicker() {
    // Open/close charts
    const chartToggle = document.getElementById('charts-toggle');
    const charts = document.getElementById("charts");
    const ticker = document.querySelector(".ticker-main");

    function toggleCharts() {
        const charts = document.querySelector('#charts');
        charts.classList.toggle('collapsed');

        const isCollapsed = charts.classList.contains('collapsed');
        gtag('event', 'charts_toggle', {
            chart_state: isCollapsed ? 'collapsed' : 'expanded'
        });
    }

    // Toggle charts on toggle click
    chartToggle.addEventListener('click', () => {
        toggleCharts();
    });

    document.addEventListener("click", function(event) {
        // Close if user clicks outside chart
        if (!charts.contains(event.target) && !chartToggle.contains(event.target) && !charts.classList.contains("collapsed")) {
            toggleCharts();
        }
        // Open if user clicks ticker
        else if (ticker.contains(event.target) && event.target.tagName != "A" && charts.classList.contains("collapsed")) {
            toggleCharts();
        }
    });

    // Allow swipe down on ticker to see charts
    function onSwipeDown(element, callback, threshold = 100) {
        let startY = null;
        let isSwiping = false;

        element.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            isSwiping = true;
        }, {
            passive: false
        });

        element.addEventListener('touchmove', (e) => {
            if (!isSwiping) return;

            const currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;

            if (deltaY > 0) {
                e.preventDefault();
            }

            // Trigger callback if threshold is exceeded
            if (deltaY > threshold) {
                callback();
                isSwiping = false;
            }
        }, {
            passive: false
        });

        element.addEventListener('touchend', () => {
            isSwiping = false;
        });
    }

    const swipeElement = document.querySelector('.ticker-main');
    onSwipeDown(swipeElement, () => {
        if (charts.classList.contains("collapsed")) toggleCharts()
    }, 25);
}