// "Activity by Day" and "Activity by Hour" charts

// Charts - Graphs
import { hourlyActivity, dailyActivity, hourlyListeners, dailyListeners } from "./data.js";

export let hourlyChart = null;
export let dailyChart = null;

// Create hourly activity bar chart
export function createHourlyChart() {
    const chartContainer = document.getElementById("hourly-chart");
    chartContainer.innerHTML = '<canvas></canvas>';

    const ctx = chartContainer.querySelector('canvas').getContext('2d');

    if (hourlyChart) {
        hourlyChart.destroy();
    }

    hourlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Array.from({length: 24}, (_, i) => {
                const date = new Date();
                date.setHours(i, 0, 0, 0);
                return date.toLocaleTimeString([], {
                    hour: 'numeric'
                });
            }),
            datasets: [{
                data: hourlyActivity,
                backgroundColor: 'rgba(100, 100, 255, 0.5)',
                borderColor: 'rgba(100, 100, 255, 0.8)',
                borderWidth: 1,
                hoverBackgroundColor: 'rgba(100, 100, 255, 0.8)',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    usePointStyle: true,
                    enabled: false,
                    external: function(context) {
                        const tooltipEl = document.createElement('div');
                        tooltipEl.style.background = 'rgba(0, 0, 0, 0.8)';
                        tooltipEl.style.borderRadius = '4px';
                        tooltipEl.style.color = 'white';
                        tooltipEl.style.opacity = 1;
                        tooltipEl.style.pointerEvents = 'none';
                        tooltipEl.style.position = 'absolute';
                        tooltipEl.style.transform = 'translate(-50%, -100%)';
                        tooltipEl.style.transition = 'all .1s ease';
                        tooltipEl.style.padding = '6px';
                        tooltipEl.style.minWidth = '150px';
                        tooltipEl.style.maxWidth = '180px';
                        tooltipEl.style.fontSize = '12px';
                        tooltipEl.style.zIndex = '1000';
                        tooltipEl.style.marginTop = '-15px';

                        // Get hovered hour
                        const hour = context.tooltip.dataPoints[0].dataIndex;
                        const listeners = hourlyListeners[hour];
                        const totalPlays = context.tooltip.dataPoints[0].raw;

                        const date = new Date();
                        date.setHours(hour, 0, 0, 0);
                        const timeStr = date.toLocaleTimeString([], {
                            hour: 'numeric'
                        });

                        // Get top 3 listeners for this hour
                        const sortedListeners = Array.from(listeners.entries())
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 3);

                        // Build tooltip content, looping through listeners
                        let tooltipContent = `<div style="margin-bottom: 4px; font-weight: bold;">${timeStr} - ${totalPlays.toLocaleString()} plays</div>`;

                        if (sortedListeners.length > 0) {
                            sortedListeners.forEach(([username, count]) => {
                                const userBlock = document.querySelector(`[data-username="${username}"]`);
                                const profileUrl = userBlock ?
                                    userBlock.querySelector('#pfp').src :
                                    `https://lastfm.freetls.fastly.net/i/u/300x300/5c66a0d6f81115c6d551493c9298b43b.png`;

                                tooltipContent += `
                                    <div style="display: flex; align-items: center; margin: 2px 0;">
                                        <img src="${profileUrl}" style="width: 16px; height: 16px; border-radius: 50%; margin-right: 6px;">
                                        <span>${username}: ${count.toLocaleString()}</span>
                                    </div>
                                `;
                            });
                        }

                        tooltipEl.innerHTML = tooltipContent;

                        // Position tooltip based on cursor
                        const position = context.chart.canvas.getBoundingClientRect();
                        const cursorX = context.tooltip.caretX;
                        const chartWidth = context.chart.width;

                        const shouldShowOnLeft = cursorX > (chartWidth / 2);

                        if (shouldShowOnLeft) {
                            tooltipEl.style.right = (window.innerWidth - (position.left + cursorX) + 10) + 'px';
                            tooltipEl.style.left = 'auto';
                            tooltipEl.style.transform = 'translateY(-50%)';
                        } else {
                            tooltipEl.style.left = (position.left + cursorX + 10) + 'px';
                            tooltipEl.style.right = 'auto';
                            tooltipEl.style.transform = 'translateY(-50%)';
                        }

                        tooltipEl.style.top = position.top + context.tooltip.caretY + window.scrollY + 'px';

                        // Remove any existing tooltips
                        const existingTooltip = document.querySelector('.chart-tooltip');
                        if (existingTooltip) {
                            existingTooltip.remove();
                        }

                        tooltipEl.classList.add('chart-tooltip');
                        document.body.appendChild(tooltipEl);

                        // Add event listeners to remove tooltip
                        const removeTooltip = () => {
                            const tooltip = document.querySelector('.chart-tooltip');
                            if (tooltip) {
                                tooltip.remove();
                            }
                            window.removeEventListener('mousemove', handleMouseMove);
                            window.removeEventListener('scroll', removeTooltip);
                            window.removeEventListener('touchmove', removeTooltip);
                        };

                        const handleMouseMove = (e) => {
                            const points = context.chart.getElementsAtEventForMode(e, 'point', {
                                intersect: true
                            });
                            if (points.length === 0) {
                                removeTooltip();
                            }
                        };

                        window.addEventListener('mousemove', handleMouseMove);
                        window.addEventListener('scroll', removeTooltip, {
                            passive: true
                        });
                        window.addEventListener('touchmove', removeTooltip, {
                            passive: true
                        });

                        return removeTooltip;
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        display: false
                    },
                    ticks: {
                        display: false
                    },
                    border: {
                        display: false
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.4)',
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 6,
                        font: {
                            size: 10
                        }
                    },
                    border: {
                        display: false
                    }
                }
            },
            animation: {
                duration: 500
            }
        }
    });
}

// Create daily activity polar area chart
export function createDailyChart() {
    const chartContainer = document.getElementById("daily-chart");
    chartContainer.innerHTML = '<canvas></canvas>';

    const ctx = chartContainer.querySelector('canvas').getContext('2d');

    if (dailyChart) {
        dailyChart.destroy();
    }

    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    dailyChart = new Chart(ctx, {
        type: 'polarArea',
        data: {
            labels: labels,
            datasets: [{
                data: dailyActivity,
                backgroundColor: [
                    'rgba(100, 100, 255, 0.5)',
                    'rgba(100, 100, 255, 0.6)',
                    'rgba(100, 100, 255, 0.7)',
                    'rgba(100, 100, 255, 0.8)',
                    'rgba(100, 100, 255, 0.7)',
                    'rgba(100, 100, 255, 0.6)',
                    'rgba(100, 100, 255, 0.5)'
                ],
                borderColor: 'rgba(100, 100, 255, 0.8)',
                borderWidth: 1,
                hoverBackgroundColor: 'rgba(100, 100, 255, 0.9)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    usePointStyle: true,
                    enabled: false,
                    external: function(context) {
                        const tooltipEl = document.createElement('div');
                        tooltipEl.style.background = 'rgba(0, 0, 0, 0.8)';
                        tooltipEl.style.borderRadius = '4px';
                        tooltipEl.style.color = 'white';
                        tooltipEl.style.opacity = 1;
                        tooltipEl.style.pointerEvents = 'none';
                        tooltipEl.style.position = 'absolute';
                        tooltipEl.style.transform = 'translate(-50%, -100%)';
                        tooltipEl.style.transition = 'all .1s ease';
                        tooltipEl.style.padding = '6px';
                        tooltipEl.style.minWidth = '150px';
                        tooltipEl.style.maxWidth = '180px';
                        tooltipEl.style.fontSize = '12px';
                        tooltipEl.style.zIndex = '1000';
                        tooltipEl.style.marginTop = '-8px';

                        // Get hovered day
                        const day = context.tooltip.dataPoints[0].dataIndex;
                        const listeners = dailyListeners[day];
                        const totalPlays = context.tooltip.dataPoints[0].raw;

                        const dayDisplay = labels[day];

                        // Get top 3 listeners
                        const sortedListeners = Array.from(listeners.entries())
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 3);

                        // Build tooltip content, looping through listeners
                        let tooltipContent = `<div style="margin-bottom: 4px; font-weight: bold;">${dayDisplay} - ${totalPlays.toLocaleString()} plays</div>`;

                        if (sortedListeners.length > 0) {
                            sortedListeners.forEach(([username, count]) => {
                                const userBlock = document.querySelector(`[data-username="${username}"]`);
                                const profileUrl = userBlock ?
                                    userBlock.querySelector('#pfp').src :
                                    `https://lastfm.freetls.fastly.net/i/u/300x300/5c66a0d6f81115c6d551493c9298b43b.png`;

                                tooltipContent += `
                                    <div style="display: flex; align-items: center; margin: 2px 0;">
                                        <img src="${profileUrl}" style="width: 16px; height: 16px; border-radius: 50%; margin-right: 6px;">
                                        <span>${username}: ${count.toLocaleString()}</span>
                                    </div>
                                `;
                            });
                        }

                        tooltipEl.innerHTML = tooltipContent;

                        // Position tooltip
                        const position = context.chart.canvas.getBoundingClientRect();
                        tooltipEl.style.left = position.left + context.tooltip.caretX + 'px';
                        tooltipEl.style.top = position.top + context.tooltip.caretY + window.scrollY + 'px';

                        // Remove any existing tooltips
                        const existingTooltip = document.querySelector('.chart-tooltip');
                        if (existingTooltip) {
                            existingTooltip.remove();
                        }

                        tooltipEl.classList.add('chart-tooltip');
                        document.body.appendChild(tooltipEl);

                        // Add event listeners to remove tooltip
                        const removeTooltip = () => {
                            const tooltip = document.querySelector('.chart-tooltip');
                            if (tooltip) {
                                tooltip.remove();
                            }
                            window.removeEventListener('mousemove', handleMouseMove);
                            window.removeEventListener('scroll', removeTooltip);
                            window.removeEventListener('touchmove', removeTooltip);
                        };

                        const handleMouseMove = (e) => {
                            const points = context.chart.getElementsAtEventForMode(e, 'point', {
                                intersect: true
                            });
                            if (points.length === 0) {
                                removeTooltip();
                            }
                        };

                        window.addEventListener('mousemove', handleMouseMove);
                        window.addEventListener('scroll', removeTooltip, {
                            passive: true
                        });
                        window.addEventListener('touchmove', removeTooltip, {
                            passive: true
                        });

                        return removeTooltip;
                    }
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    ticks: {
                        display: false
                    },
                    grid: {
                        display: false
                    },
                    pointLabels: {
                        display: true,
                        color: 'rgba(255, 255, 255, 0.8)',
                        font: {
                            size: 12,
                            weight: 'bold'
                        },
                        padding: 4,
                        centerPointLabels: true
                    }
                }
            },
            animation: {
                duration: 500
            }
        }
    });
}