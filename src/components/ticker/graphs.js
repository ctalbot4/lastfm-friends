const hourlyActivity = new Array(24).fill(0);
const tempHourlyActivity = new Array(24).fill(0);
const hourlyListeners = Array.from({ length: 24 }, () => new Map());
const tempHourlyListeners = Array.from({ length: 24 }, () => new Map());

const dailyActivity = new Array(7).fill(0);
const tempDailyActivity = new Array(7).fill(0);
const dailyListeners = Array.from({ length: 7 }, () => new Map());
const tempDailyListeners = Array.from({ length: 7 }, () => new Map());

let activityChart = null;
let dailyChart = null;

function processTrack(timestamp, username) {
    const date = new Date(timestamp * 1000);
    const hour = date.getHours();
    const day = date.getDay();
    
    tempHourlyActivity[hour]++;
    const hourlyListenersMap = tempHourlyListeners[hour];
    hourlyListenersMap.set(username, (hourlyListenersMap.get(username) || 0) + 1);
    
    tempDailyActivity[day]++;
    const dailyListenersMap = tempDailyListeners[day];
    dailyListenersMap.set(username, (dailyListenersMap.get(username) || 0) + 1);
}

export function createHourlyChart() {
    const chartContainer = document.getElementById("activity-chart");
    chartContainer.innerHTML = '<canvas></canvas>';
    
    const ctx = chartContainer.querySelector('canvas').getContext('2d');
    
    // Destroy existing chart if it exists
    if (activityChart) {
        activityChart.destroy();
    }
    
    // Create labels for hours
    const labels = Array.from({length: 24}, (_, i) => `${i}:00`);
    
    activityChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
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

                        const hour = context.tooltip.dataPoints[0].dataIndex;
                        const listeners = hourlyListeners[hour];
                        const totalPlays = context.tooltip.dataPoints[0].raw;
                        
                        // Format hour for display
                        const hourDisplay = `${hour.toString().padStart(2, '0')}:00`;
                        
                        // Convert map to array and sort by play count
                        const sortedListeners = Array.from(listeners.entries())
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 3);
                        
                        let tooltipContent = `<div style="margin-bottom: 4px; font-weight: bold;">${hourDisplay} - ${totalPlays} plays</div>`;
                        
                        if (sortedListeners.length > 0) {
                            sortedListeners.forEach(([username, count]) => {
                                const userBlock = document.querySelector(`[data-username="${username}"]`);
                                const profileUrl = userBlock ? 
                                    userBlock.querySelector('#pfp').src :
                                    `https://lastfm.freetls.fastly.net/i/u/300x300/5c66a0d6f81115c6d551493c9298b43b.png`;
                                
                                tooltipContent += `
                                    <div style="display: flex; align-items: center; margin: 2px 0;">
                                        <img src="${profileUrl}" style="width: 16px; height: 16px; border-radius: 50%; margin-right: 6px;">
                                        <span>${username}: ${count}</span>
                                    </div>
                                `;
                            });
                        }
                        
                        tooltipEl.innerHTML = tooltipContent;
                        
                        const position = context.chart.canvas.getBoundingClientRect();
                        tooltipEl.style.left = position.left + context.tooltip.caretX + 'px';
                        tooltipEl.style.top = position.top + context.tooltip.caretY + 'px';
                        
                        // Remove any existing tooltips
                        const existingTooltip = document.querySelector('.chart-tooltip');
                        if (existingTooltip) {
                            existingTooltip.remove();
                        }
                        
                        tooltipEl.classList.add('chart-tooltip');
                        document.body.appendChild(tooltipEl);
                        
                        // Add event listeners to remove tooltip
                        const chart = context.chart.canvas;
                        const removeTooltip = () => {
                            const tooltip = document.querySelector('.chart-tooltip');
                            if (tooltip) {
                                tooltip.remove();
                            }
                            chart.removeEventListener('mouseleave', removeTooltip);
                            window.removeEventListener('scroll', removeTooltip);
                            window.removeEventListener('touchmove', removeTooltip);
                        };
                        
                        chart.addEventListener('mouseleave', removeTooltip);
                        window.addEventListener('scroll', removeTooltip, { passive: true });
                        window.addEventListener('touchmove', removeTooltip, { passive: true });
                        
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

export function createDailyChart() {
    const chartContainer = document.getElementById("daily-chart");
    chartContainer.innerHTML = '<canvas></canvas>';
    
    const ctx = chartContainer.querySelector('canvas').getContext('2d');
    
    // Destroy existing chart if it exists
    if (dailyChart) {
        dailyChart.destroy();
    }
    
    // Create labels for days
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

                        const day = context.tooltip.dataPoints[0].dataIndex;
                        const listeners = dailyListeners[day];
                        const totalPlays = context.tooltip.dataPoints[0].raw;
                        
                        // Format day for display
                        const dayDisplay = labels[day];
                        
                        // Convert map to array and sort by play count
                        const sortedListeners = Array.from(listeners.entries())
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 3);
                        
                        let tooltipContent = `<div style="margin-bottom: 4px; font-weight: bold;">${dayDisplay} - ${totalPlays} plays</div>`;
                        
                        if (sortedListeners.length > 0) {
                            sortedListeners.forEach(([username, count]) => {
                                const userBlock = document.querySelector(`[data-username="${username}"]`);
                                const profileUrl = userBlock ? 
                                    userBlock.querySelector('#pfp').src :
                                    `https://lastfm.freetls.fastly.net/i/u/300x300/5c66a0d6f81115c6d551493c9298b43b.png`;
                                
                                tooltipContent += `
                                    <div style="display: flex; align-items: center; margin: 2px 0;">
                                        <img src="${profileUrl}" style="width: 16px; height: 16px; border-radius: 50%; margin-right: 6px;">
                                        <span>${username}: ${count}</span>
                                    </div>
                                `;
                            });
                        }
                        
                        tooltipEl.innerHTML = tooltipContent;
                        
                        const position = context.chart.canvas.getBoundingClientRect();
                        tooltipEl.style.left = position.left + context.tooltip.caretX + 'px';
                        tooltipEl.style.top = position.top + context.tooltip.caretY + 'px';
                        
                        // Remove any existing tooltips
                        const existingTooltip = document.querySelector('.chart-tooltip');
                        if (existingTooltip) {
                            existingTooltip.remove();
                        }
                        
                        tooltipEl.classList.add('chart-tooltip');
                        document.body.appendChild(tooltipEl);
                        
                        // Add event listeners to remove tooltip
                        const chart = context.chart.canvas;
                        const removeTooltip = () => {
                            const tooltip = document.querySelector('.chart-tooltip');
                            if (tooltip) {
                                tooltip.remove();
                            }
                            chart.removeEventListener('mouseleave', removeTooltip);
                            window.removeEventListener('scroll', removeTooltip);
                            window.removeEventListener('touchmove', removeTooltip);
                        };
                        
                        chart.addEventListener('mouseleave', removeTooltip);
                        window.addEventListener('scroll', removeTooltip, { passive: true });
                        window.addEventListener('touchmove', removeTooltip, { passive: true });
                        
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

export function resetActivityData() {
    tempHourlyActivity.fill(0);
    tempDailyActivity.fill(0);
    tempHourlyListeners.forEach(listeners => listeners.clear());
    tempDailyListeners.forEach(listeners => listeners.clear());
}

export function updateActivityData(tracks, username) {
    tracks.forEach(track => {
        if (track.date?.uts) {
            processTrack(parseInt(track.date.uts), username);
        }
    });
}

export function updateActivityChart() {
    // Copy temp data
    hourlyActivity.fill(0);
    tempHourlyActivity.forEach((count, hour) => {
        hourlyActivity[hour] = count;
    });
    
    dailyActivity.fill(0);
    tempDailyActivity.forEach((count, day) => {
        dailyActivity[day] = count;
    });
    
    hourlyListeners.forEach((listeners, hour) => {
        listeners.clear();
        tempHourlyListeners[hour].forEach((count, username) => {
            listeners.set(username, count);
        });
    });
    
    dailyListeners.forEach((listeners, day) => {
        listeners.clear();
        tempDailyListeners[day].forEach((count, username) => {
            listeners.set(username, count);
        });
    });
    
    if (activityChart) {
        activityChart.data.datasets[0].data = hourlyActivity;
        activityChart.update();
    } else {
        createHourlyChart();
    }
    
    if (dailyChart) {
        dailyChart.data.datasets[0].data = dailyActivity;
        dailyChart.update();
    } else {
        createDailyChart();
    }
}