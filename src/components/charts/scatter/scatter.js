// "Every Play From Every Friend" chart

// Charts - Scatter
import { buckets } from "./data.js";

// Charts
import { trackData } from "../update.js";

// Helper functions
const minuteOfDay = d => d.getHours() * 60 + d.getMinutes() + (d.getSeconds() / 60);
const dayOfWeek = d => d.getDay();

// Constants
const DAY_WIDTH = 100;

// Update current time line
export function getCurrentTimeDataset() {
    const now = new Date();
    const yMinutes = minuteOfDay(now);
    const xStart = (dayOfWeek(now) - 0.5) * DAY_WIDTH;
    const xEnd = (dayOfWeek(now) + 0.5) * DAY_WIDTH;

    return {
        label: 'current-time',
        data: [{ x: xStart, y: yMinutes }, { x: xEnd, y: yMinutes }],
        showLine: true,
        pointRadius: 0,
        borderColor: 'rgba(100, 100, 255, 0.5)',
        borderWidth: 1,
        order: 0
    };
}

export let scatterChart = null;

// Create scatter plot chart
export function createScatterPlot() {
    const chartContainer = document.getElementById("scatter-chart");
    chartContainer.innerHTML = '<canvas></canvas>';
    
    const ctx = chartContainer.querySelector('canvas').getContext('2d');
    
    // Create stub dataset for top axis
    const stubDataset = {
        label: 'axis-stub',
        data: [],
        xAxisID: 'xTop',
        yAxisID: 'y',
        hidden: true,
        pointRadius: 0
    };

    // Create day separator lines
    const DAY_SEPARATORS = Array.from({ length: 6 }, (_, i) => {
        const xPos = (i + 0.5) * DAY_WIDTH;
        return {
            label: 'day-divider',
            data: [{ x: xPos, y: 0 }, { x: xPos, y: 1440 }],
            borderColor: 'rgba(255,255,255,0.15)',
            borderWidth: 1,
            pointRadius: 0,
            showLine: true,
            order: 0,
            hoverRadius: 0,
            hitRadius: 0
        };
    });
    
    const chart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [...DAY_SEPARATORS, stubDataset]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            normalized: true,
            layout: {
                padding: {
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0
                }
            },
            scales: {
                // Bottom x-axis configuration (day)
                x: {
                    type: 'linear',
                    min: -0.4 * DAY_WIDTH,
                    max: 6.4 * DAY_WIDTH,
                    ticks: {
                        autoSkip: false,
                        callback: v => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][v / DAY_WIDTH],
                        font: {
                            size: 11
                        },
                        padding: 4
                    },
                    grid: {
                        display: false
                    }
                },
                // Top x-axis configuration (mirrors bottom)
                xTop: {
                    axis: 'x',
                    type: 'linear',
                    position: 'top',
                    min: -0.4 * DAY_WIDTH,
                    max: 6.4 * DAY_WIDTH,
                    ticks: {
                        autoSkip: false,
                        callback: v => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][v / DAY_WIDTH],
                        font: {
                            size: 11
                        },
                        padding: 4
                    },
                    grid: {
                        display: false
                    }
                },             
                // Y-axis configuration (time)
                y: {
                    min: 0,
                    max: 1440,
                    ticks: {
                        stepSize: 240,
                        callback: v => {
                            const date = new Date();
                            date.setHours(Math.floor(v / 60), v % 60, 0, 0);
                            return date.toLocaleTimeString([], {
                                hour: 'numeric'
                            });
                        },
                        font: {
                            size: 10
                        },
                        padding: 2,
                    },
                    reverse: true,
                    border: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    align: 'start',
                    labels: {
                        padding: 20,
                        filter: (legendItem, data) => {
                            // Skip dummy datasets
                            const dataset = data.datasets[legendItem.datasetIndex];
                            return dataset.label !== 'axis-stub' && dataset.label !== 'day-divider' && dataset.label !== "current-time";
                        }
                    }
                },
                tooltip: {
                    intersect: true,
                    mode: 'nearest',
                    usePointStyle: true,
                    enabled: false,
                    external: function(context) {
                        // Return early if no data points are available
                        if (!context.tooltip.dataPoints || context.tooltip.dataPoints.length === 0 || context.tooltip.opacity === 0) {
                            return;
                        }

                        let tooltipEl = context.chart.canvas._tooltipEl;
                        if (!tooltipEl) {
                            tooltipEl = document.createElement('div');
                            tooltipEl.className = 'scatter-tooltip';
                            tooltipEl.style.background = 'rgba(0, 0, 0, 0.8)';
                            tooltipEl.style.borderRadius = '4px';
                            tooltipEl.style.color = 'white';
                            tooltipEl.style.opacity = 1;
                            tooltipEl.style.pointerEvents = 'none';
                            tooltipEl.style.position = 'absolute';
                            tooltipEl.style.transform = 'translate(-50%, -100%)';
                            tooltipEl.style.transition = 'all .1s ease';
                            tooltipEl.style.padding = '6px';
                            tooltipEl.style.minWidth = '200px';
                            tooltipEl.style.maxWidth = '300px';
                            tooltipEl.style.fontSize = '12px';
                            tooltipEl.style.zIndex = '1000';
                            tooltipEl.style.marginTop = '-8px';
                            tooltipEl.style.maxHeight = '400px';
                            tooltipEl.style.overflowY = 'auto';
                            document.body.appendChild(tooltipEl);
                            context.chart.canvas._tooltipEl = tooltipEl;
                        }

                        tooltipEl.style.opacity = 1;

                        const { raw } = context.tooltip.dataPoints[0];
                        const newKey = `${raw.user}:${raw.timestamp}`;

                        // If we are on the same point, return early and don't update tooltip
                        if (tooltipEl.dataset.key == newKey) {
                            const removeTooltip = () => {
                                if (tooltipEl) {
                                    tooltipEl.style.opacity = 0;
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
                            return removeTooltip;
                        }

                        tooltipEl.dataset.key = newKey;

                        const date = new Date(raw.timestamp * 1000);
                        const timeStr = date.toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit'
                        });
                        const dayStr = date.toLocaleDateString([], {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                        });
                        
                        // Get all plays in this bucket
                        const bucketPlays = buckets[raw.bucketKey] || [];
                        const sortedPlays = bucketPlays.sort((a, b) => a.timestamp - b.timestamp);
                        
                        // Get track statistics
                        const trackKey = `${raw.track}::${raw.artist}`;
                        const trackStats = trackData[trackKey];
                                                
                        let tooltipContent = `<div style="margin-bottom: 4px; font-weight: bold;">${dayStr} ${timeStr}</div>`;
                        
                        // Add hovered point info
                        const userBlock = document.querySelector(`[data-username="${raw.user}"]`);
                        const profileUrl = userBlock ? 
                            userBlock.querySelector('#pfp').src :
                            `https://lastfm.freetls.fastly.net/i/u/300x300/5c66a0d6f81115c6d551493c9298b43b.png`;
                        
                        tooltipContent += `
                            <div style="display: flex; align-items: center; margin: 2px 0; padding: 2px 0; border-bottom: 1px solid rgba(255,255,255,0.2);">
                                <img src="${profileUrl}" style="width: 16px; height: 16px; border-radius: 50%; margin-right: 6px;">
                                <img src="${raw.image}" style="width: 32px; height: 32px; margin-right: 6px;">
                                <div style="flex-grow: 1;">
                                    <div style="font-weight: bold;">${raw.user}</div>
                                    <div style="font-size: 11px; opacity: 0.8;">${raw.track} by ${raw.artist}</div>
                                </div>
                                ${trackStats ? `
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                                            <div style="display: flex; align-items: center; gap: 4px;">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <path d="M5 3l14 9-14 9V3z"/>
                                                </svg>
                                                <span style="font-size: 11px;">${trackStats.plays.toLocaleString()}</span>
                                            </div>
                                            <div style="display: flex; align-items: center; gap: 4px;">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                                                    <circle cx="9" cy="7" r="4"/>
                                                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                                                </svg>
                                                <span style="font-size: 11px;">${Object.keys(trackStats.users).length}</span>
                                            </div>
                                        </div>
                                        ${Object.keys(trackStats.users).length > 1 ? `
                                            <div style="display: flex; align-items: center; gap: 2px;">
                                                ${Object.entries(trackStats.users)
                                                    .sort((a, b) => b[1] - a[1])
                                                    .slice(0, 3)
                                                    .map(([username]) => {
                                                        const listenerBlock = document.querySelector(`[data-username="${username}"]`);
                                                        const listenerProfileUrl = listenerBlock ? 
                                                            listenerBlock.querySelector('#pfp').src :
                                                            `https://lastfm.freetls.fastly.net/i/u/300x300/5c66a0d6f81115c6d551493c9298b43b.png`;
                                                        return `<img src="${listenerProfileUrl}" style="width: 16px; height: 16px; border-radius: 50%;" title="${username}">`;
                                                    }).join('')}
                                            </div>
                                        ` : ''}
                                    </div>
                                ` : ''}
                            </div>
                        `;

                        // Then show other plays in the bucket
                        if (sortedPlays.length > 1) {
                            const otherPlays = sortedPlays.filter(play => 
                                play.username !== raw.user
                            );
                            
                            if (otherPlays.length > 0) {
                                tooltipContent += `
                                    <div style="margin-top: 4px; font-size: 11px; opacity: 0.8;">Other plays at this time:</div>
                                    <div class="other-plays-container" style="max-height: 120px; overflow: hidden; position: relative;">
                                        <div class="other-plays-list" style="transition: transform ${otherPlays.length * 0.75}s linear;">
                                            ${otherPlays.map(play => {
                                                const playDate = new Date(play.timestamp * 1000);
                                                const playTimeStr = playDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                                                const playUserBlock = document.querySelector(`[data-username="${play.username}"]`);
                                                const playProfileUrl = playUserBlock ? 
                                                    playUserBlock.querySelector('#pfp').src :
                                                    `https://lastfm.freetls.fastly.net/i/u/300x300/5c66a0d6f81115c6d551493c9298b43b.png`;
                                                
                                                return `
                                                    <div style="display: flex; align-items: center; margin: 2px 0;">
                                                        <img src="${playProfileUrl}" style="width: 14px; height: 14px; border-radius: 50%; margin-right: 6px;">
                                                        <img src="${play.image}" style="width: 20px; height: 20px; margin-right: 6px;">
                                                        <div>
                                                            <div style="font-size: 11px;">${playTimeStr} - ${play.username}</div>
                                                            <div style="font-size: 10px; opacity: 0.8;">${play.track} by ${play.artist}</div>
                                                        </div>
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                    </div>
                                `;
                            }
                        }
                        
                        tooltipEl.innerHTML = tooltipContent;
                        
                        // Add auto-scroll animation for other plays
                        setTimeout(() => {
                            const container = tooltipEl.querySelector('.other-plays-container');
                            const list = tooltipEl.querySelector('.other-plays-list');
                            if (container && list) {
                                const containerHeight = container.offsetHeight;
                                const listHeight = list.scrollHeight;
                                
                                if (listHeight > containerHeight) {
                                    // Start scrolling after 1.5 seconds
                                    setTimeout(() => {
                                        list.style.transform = `translateY(-${listHeight - containerHeight + 5}px)`;
                                    }, 3500);
                                }
                            }
                        }, 100);
                        
                        // Position tooltip based on cursor
                        const position = context.chart.canvas.getBoundingClientRect();
                        const cursorX = context.tooltip.caretX;
                        const chartWidth = context.chart.width;
                        
                        const shouldShowOnLeft = cursorX > (chartWidth / 2);
                        
                        if (shouldShowOnLeft) {
                            tooltipEl.style.right = (window.innerWidth - (position.left + cursorX) + 15) + 'px';
                            tooltipEl.style.left = 'auto';
                            tooltipEl.style.transform = 'translateY(-50%)';
                        } else {
                            tooltipEl.style.left = (position.left + cursorX + 15) + 'px';
                            tooltipEl.style.right = 'auto';
                            tooltipEl.style.transform = 'translateY(-50%)';
                        }
                        
                        tooltipEl.style.top = position.top + context.tooltip.caretY + window.scrollY + 'px';
                        
                        // Add event listeners to remove tooltip
                        const removeTooltip = () => {
                            if (tooltipEl) {
                                tooltipEl.style.opacity = 0;
                            }
                            window.removeEventListener('mousemove', handleMouseMove);
                            window.removeEventListener('scroll', removeTooltip);
                            window.removeEventListener('touchmove', removeTooltip);
                        };

                        const handleMouseMove = (e) => {
                            const points = context.chart.getElementsAtEventForMode(e, 'point', { intersect: true });
                            if (points.length === 0) {
                                removeTooltip();
                            }
                        };
                        
                        window.addEventListener('mousemove', handleMouseMove);
                        window.addEventListener('scroll', removeTooltip, { passive: true });
                        window.addEventListener('touchmove', removeTooltip, { passive: true });
                    }
                }
            }
        }
    });

    // Add current time line
    chart.data.datasets.push(getCurrentTimeDataset());
    
    scatterChart = chart;
}