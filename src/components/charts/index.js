// Charts - Scatter
import { tryScatterUpdate } from "./scatter/data.js";

// Preview
import { audioState } from "../preview/index.js";

export function initCharts() {
    // Open/close charts
    const chartToggle = document.getElementById('charts-toggle');
    const charts = document.getElementById("charts");
    const ticker = document.querySelector(".ticker-main");

    // Ticker charts toggle
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

    // Chart view toggle
    document.querySelectorAll('#inner-charts-toggle button').forEach(button => {
        button.addEventListener('click', () => {
            toggleView(button.dataset.view);
        });
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

    // Clear tooltips
    const tooltip = document.querySelector('.chart-tooltip');
    if (tooltip) {
        tooltip.remove();
    }

    charts.classList.toggle('collapsed');

    gtag('event', 'charts_toggle', {
        chart_state: isCollapsed ? 'expanded' : 'collapsed'
    });
}

// Toggle between charts and scatter
function toggleView(view) {
    const charts = document.querySelector('#charts');
    const scrollable = charts.querySelector('.charts-scrollable');
    const buttons = document.querySelectorAll('#inner-charts-toggle button');
    const chartSections = document.querySelectorAll('.chart-section:not(#scatter-section)');
    const scatterSection = document.querySelector('#scatter-section');

    // Update active button
    buttons.forEach(button => {
        button.classList.toggle('active', button.dataset.view === view);
    });

    // Show or hide sections
    if (view === 'scatter') {
        chartSections.forEach(section => section.style.display = 'none');
        scatterSection.style.display = '';
        tryScatterUpdate();
        gtag('event', 'scatter_view');
    } else {
        chartSections.forEach(section => section.style.display = '');
        scatterSection.style.display = 'none';
    }

    // Clear tooltips
    const tooltip = document.querySelector('.chart-tooltip');
    if (tooltip) {
        tooltip.remove();
    }

    // Reset scroll position
    scrollable.scrollTop = 0;
}