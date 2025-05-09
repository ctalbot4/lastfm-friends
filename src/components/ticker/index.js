// State
import { audioState } from "../preview/index.js";

export function initTicker() {
    // Open/close charts
    const chartToggle = document.getElementById('charts-toggle');
    const charts = document.getElementById("charts");
    const ticker = document.querySelector(".ticker-main");

    function toggleCharts() {
        const charts = document.querySelector('#charts');
        const isCollapsed = charts.classList.contains('collapsed');

        // Stop any playing audio when closing charts
        if (!isCollapsed && audioState.currentChartAudio) {
            audioState.currentChartAudio.pause();
            audioState.currentChartAudio.currentTime = 0;
            // Reset any playing buttons
            document.querySelectorAll('.play-button.playing').forEach(button => {
                button.classList.remove('playing');
                button.querySelector('.play-icon').style.display = 'block';
                button.querySelector('.pause-icon').style.display = 'none';
            });
        }

        // Clear any tooltips on activity graphs
        const tooltip = document.querySelector('.chart-tooltip');
        if (tooltip) {
            tooltip.remove();
        }

        charts.classList.toggle('collapsed');

        gtag('event', 'charts_toggle', {
            chart_state: isCollapsed ? 'expanded' : 'collapsed'
        });
    }

    // Toggle charts on toggle click
    chartToggle.addEventListener('click', () => {
        toggleCharts();
    });

    // Toggle charts on collapse handle click
    document.querySelector('.charts-collapse-handle').addEventListener('click', () => {
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