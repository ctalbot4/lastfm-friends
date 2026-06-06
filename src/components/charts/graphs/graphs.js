// "Activity by Day" and "Activity by Hour" charts

// Charts - Graphs
import { hourlyActivity, dailyActivity, hourlyListeners, dailyListeners, DECADE_LABELS, decadePlays, decadeUsers, decadeAlbums, yearUsers, yearAlbums } from "./data.js";

export let hourlyChart = null;
export let dailyChart = null;
export let decadeChart = null;

// Get shade of blue for hourly activity bars
export function computeHourlyColors(data) {
    const max = Math.max(...data, 1);
    return data.map(value => {
        if (value === 0) return 'hsla(214, 60%, 10%, 0.4)';
        const l = 12 + (value / max) * 58;
        return `hsla(214, 80%, ${l.toFixed(0)}%, 0.8)`;
    });
}

// Get border color for hourly activity bars
export function computeHourlyBorderColors(data) {
    const max = Math.max(...data, 1);
    return data.map(value => {
        if (value === 0) return 'hsla(214, 60%, 15%, 0.5)';
        const l = 18 + (value / max) * 57;
        return `hsla(214, 85%, ${l.toFixed(0)}%, 0.95)`;
    });
}

// Get hover color for hourly activity bars
export function computeHourlyHoverColors(data) {
    const max = Math.max(...data, 1);
    return data.map(value => {
        const l = 25 + (value / max) * 50;
        return `hsla(214, 90%, ${l.toFixed(0)}%, 0.95)`;
    });
}

// Get shade of orange for decade activity bars
export function computeDecadeColors(data) {
    const max = Math.max(...data, 1);
    return data.map(value => {
        const alpha = value === 0 ? 0.08 : 0.4 + (value / max) * 0.45;
        return `rgba(251,146,60,${alpha.toFixed(2)})`;
    });
}

// Get border color for decade activity bars
export function computeDecadeBorderColors(data) {
    const max = Math.max(...data, 1);
    return data.map(value => {
        const alpha = value === 0 ? 0.15 : 0.6 + (value / max) * 0.35;
        return `rgba(251,146,60,${alpha.toFixed(2)})`;
    });
}

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
                backgroundColor: computeHourlyColors(hourlyActivity),
                borderColor: computeHourlyBorderColors(hourlyActivity),
                borderWidth: 1,
                hoverBackgroundColor: computeHourlyHoverColors(hourlyActivity),
                borderRadius: 3,
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
                        if (!context.tooltip || !context.tooltip.dataPoints || context.tooltip.dataPoints.length === 0) {
                            return;
                        }

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
                                const userBlock = document.querySelector(`.block[data-username="${username}"]`);
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
                    'rgba(248, 113, 113, 0.7)',
                    'rgba(251, 146, 60, 0.7)',
                    'rgba(250, 204, 21, 0.7)',
                    'rgba(74, 222, 128, 0.7)',
                    'rgba(56, 189, 248, 0.7)',
                    'rgba(129, 140, 248, 0.7)',
                    'rgba(232, 121, 249, 0.7)',
                ],
                borderColor: [
                    'rgba(248, 113, 113, 0.95)',
                    'rgba(251, 146, 60, 0.95)',
                    'rgba(250, 204, 21, 0.95)',
                    'rgba(74, 222, 128, 0.95)',
                    'rgba(56, 189, 248, 0.95)',
                    'rgba(129, 140, 248, 0.95)',
                    'rgba(232, 121, 249, 0.95)',
                ],
                borderWidth: 1,
                hoverBackgroundColor: [
                    'rgba(248, 113, 113, 0.95)',
                    'rgba(251, 146, 60, 0.95)',
                    'rgba(250, 204, 21, 0.95)',
                    'rgba(74, 222, 128, 0.95)',
                    'rgba(56, 189, 248, 0.95)',
                    'rgba(129, 140, 248, 0.95)',
                    'rgba(232, 121, 249, 0.95)',
                ]
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
                        if (!context.tooltip || !context.tooltip.dataPoints || context.tooltip.dataPoints.length === 0) {
                            return;
                        }

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
                                const userBlock = document.querySelector(`.block[data-username="${username}"]`);
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

export function createDecadeChart() {
    const chartContainer = document.getElementById('decade-chart');
    chartContainer.innerHTML = '<canvas></canvas>';
    const ctx = chartContainer.querySelector('canvas').getContext('2d');

    if (decadeChart) decadeChart.destroy();

    decadeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: DECADE_LABELS,
            datasets: [{
                data: [...decadePlays],
                backgroundColor: computeDecadeColors([...decadePlays]),
                borderColor: computeDecadeBorderColors([...decadePlays]),
                borderWidth: 1,
                hoverBackgroundColor: 'rgba(253,186,116,0.9)',
                categoryPercentage: 0.85,
                barPercentage: 1.0,
                borderRadius: 4,
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: function(context) {
                        if (!context.tooltip || !context.tooltip.dataPoints || context.tooltip.dataPoints.length === 0) return;

                        const idx = context.tooltip.dataPoints[0].dataIndex;
                        const totalPlays = context.tooltip.dataPoints[0].raw;
                        const label = DECADE_LABELS[idx];

                        // Get top 3 listeners
                        const sortedUsers = Array.from(decadeUsers[idx].entries())
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 3);

                        // Get top 3 albums
                        const sortedAlbums = Array.from(decadeAlbums[idx].entries())
                            .sort((a, b) => b[1].plays - a[1].plays)
                            .slice(0, 3);

                        let html = `<div style="margin-bottom:5px;font-weight:bold">${label} - ${totalPlays.toLocaleString()} plays</div>`;

                        // Build listeners tooltip content
                        if (sortedUsers.length > 0) {
                            html += `<div style="margin-bottom:3px;opacity:0.6;font-size:10px;text-transform:uppercase;letter-spacing:0.5px">Top Listeners</div>`;
                            sortedUsers.forEach(([username, count]) => {
                                const userBlock = document.querySelector(`.block[data-username="${username}"]`);
                                const profileUrl = userBlock
                                    ? userBlock.querySelector('#pfp').src
                                    : 'https://lastfm.freetls.fastly.net/i/u/300x300/5c66a0d6f81115c6d551493c9298b43b.png';
                                html += `
                                    <div style="display:flex;align-items:center;margin:2px 0">
                                        <img src="${profileUrl}" style="width:16px;height:16px;border-radius:50%;margin-right:6px;flex-shrink:0">
                                        <span>${username}: ${count.toLocaleString()}</span>
                                    </div>`;
                            });
                        }

                        // Build albums tooltip content
                        if (sortedAlbums.length > 0) {
                            html += `<div style="margin:5px 0 3px;opacity:0.6;font-size:10px;text-transform:uppercase;letter-spacing:0.5px">Top Albums</div>`;
                            sortedAlbums.forEach(([, album]) => {
                                html += `
                                    <div style="display:flex;align-items:center;margin:2px 0;gap:6px">
                                        <img src="${album.img}" style="width:20px;height:20px;border-radius:2px;flex-shrink:0;object-fit:cover">
                                        <div style="flex:1;min-width:0">
                                            <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${album.name}</div>
                                            <div style="opacity:0.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${album.artist}</div>
                                        </div>
                                        <div style="flex-shrink:0;text-align:center">${album.plays.toLocaleString()}</div>
                                    </div>`;
                            });
                        }

                        const tooltipEl = document.createElement('div');
                        tooltipEl.style.cssText = 'background:rgba(0,0,0,0.8);border-radius:4px;color:white;pointer-events:none;position:absolute;padding:6px;min-width:180px;max-width:260px;font-size:12px;z-index:1000;visibility:hidden';
                        tooltipEl.innerHTML = html;

                        const existing = document.querySelector('.chart-tooltip');
                        if (existing) existing.remove();
                        tooltipEl.classList.add('chart-tooltip');
                        document.body.appendChild(tooltipEl);

                        const tooltipWidth = tooltipEl.offsetWidth;
                        const tooltipHeight = tooltipEl.offsetHeight;
                        tooltipEl.style.visibility = '';

                        // Position tooltip
                        const position = context.chart.canvas.getBoundingClientRect();
                        const caretX = context.tooltip.caretX;
                        const caretY = context.tooltip.caretY;

                        const fitsRight = position.left + caretX + 10 + tooltipWidth <= window.innerWidth - 4;
                        let leftPx = fitsRight
                            ? position.left + caretX + 10
                            : position.left + caretX - tooltipWidth - 10;
                        leftPx = Math.max(4, leftPx);

                        let topPx = position.top + caretY + window.scrollY - tooltipHeight / 2;
                        topPx = Math.max(4, Math.min(topPx, window.scrollY + window.innerHeight - tooltipHeight - 4));

                        tooltipEl.style.left = leftPx + 'px';
                        tooltipEl.style.top = topPx + 'px';

                        // Add event listeners to remove tooltip
                        const removeTooltip = () => {
                            document.querySelector('.chart-tooltip')?.remove();
                            window.removeEventListener('mousemove', handleMouseMove);
                            window.removeEventListener('scroll', removeTooltip);
                            window.removeEventListener('touchmove', removeTooltip);
                        };
                        const handleMouseMove = (e) => {
                            if (context.chart.getElementsAtEventForMode(e, 'point', { intersect: true }).length === 0) removeTooltip();
                        };
                        window.addEventListener('mousemove', handleMouseMove);
                        window.addEventListener('scroll', removeTooltip, { passive: true });
                        window.addEventListener('touchmove', removeTooltip, { passive: true });
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { display: false },
                    ticks: { display: false },
                    border: { display: false }
                },
                y: {
                    grid: { display: false },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.4)',
                        font: { size: 11 }
                    },
                    border: { display: false }
                }
            },
            animation: { duration: 500 }
        }
    });
}

export let yearChart = null;

export function createYearChart(sortedYears, sortedPlays) {
    const chartContainer = document.getElementById('year-chart');
    chartContainer.innerHTML = '<canvas></canvas>';
    const ctx = chartContainer.querySelector('canvas').getContext('2d');

    if (yearChart) yearChart.destroy();

    yearChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedYears,
            datasets: [{
                data: sortedPlays,
                backgroundColor: 'rgba(52, 211, 153, 0.15)',
                borderColor: 'rgba(52, 211, 153, 0.85)',
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 5,
                pointBackgroundColor: 'rgba(52, 211, 153, 0.85)',
                fill: true,
                tension: 0.3,
            }]
        },
        plugins: [{
            id: 'yearGradient',
            afterLayout(chart) {
                const { ctx, chartArea } = chart;
                if (!chartArea) return;
                const { left, right, top, bottom } = chartArea;

                const lineGrad = ctx.createLinearGradient(left, 0, right, 0);
                lineGrad.addColorStop(0,   'rgba(34, 211, 238, 0.9)');
                lineGrad.addColorStop(0.5, 'rgba(20, 184, 166, 0.9)');
                lineGrad.addColorStop(1,   'rgba(163, 230, 53, 0.9)');

                const fillGrad = ctx.createLinearGradient(left, top, left, bottom);
                fillGrad.addColorStop(0, 'rgba(20, 184, 166, 0.2)');
                fillGrad.addColorStop(1, 'rgba(20, 184, 166, 0)');

                const YEAR_STOPS = [
                    { t: 0,   r: 34,  g: 211, b: 238 },
                    { t: 0.5, r: 20,  g: 184, b: 166 },
                    { t: 1,   r: 163, g: 230, b: 53  },
                ];
                const n = chart.data.datasets[0].data.length;
                const pointColors = chart.data.datasets[0].data.map((_, i) => {
                    const t = n > 1 ? i / (n - 1) : 1;
                    let r, g, b;
                    for (let j = 0; j < YEAR_STOPS.length - 1; j++) {
                        const a = YEAR_STOPS[j], b2 = YEAR_STOPS[j + 1];
                        if (t >= a.t && t <= b2.t) {
                            const s = (t - a.t) / (b2.t - a.t);
                            r = Math.round(a.r + s * (b2.r - a.r));
                            g = Math.round(a.g + s * (b2.g - a.g));
                            b = Math.round(a.b + s * (b2.b - a.b));
                            break;
                        }
                    }
                    return `rgba(${r},${g},${b},0.9)`;
                });

                chart.data.datasets[0].borderColor = lineGrad;
                chart.data.datasets[0].backgroundColor = fillGrad;
                chart.data.datasets[0].pointBackgroundColor = pointColors;
                chart.data.datasets[0].pointBorderColor = pointColors;
            }
        }],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: function(context) {
                        if (!context.tooltip?.dataPoints?.length) return;

                        const year = context.tooltip.dataPoints[0].label;
                        const totalPlays = context.tooltip.dataPoints[0].raw;

                        // Get top 3 listeners
                        const sortedUsers = [...(yearUsers.get(year)?.entries() || [])]
                            .sort((a, b) => b[1] - a[1]).slice(0, 3);

                        // Get top 3 albums
                        const sortedAlbums = [...(yearAlbums.get(year)?.entries() || [])]
                            .sort((a, b) => b[1].plays - a[1].plays).slice(0, 3);

                        let html = `<div style="margin-bottom:5px;font-weight:bold">${year} - ${totalPlays.toLocaleString()} plays</div>`;

                        // Build listeners tooltip content
                        if (sortedUsers.length > 0) {
                            html += `<div style="margin-bottom:3px;opacity:0.6;font-size:10px;text-transform:uppercase;letter-spacing:0.5px">Top Listeners</div>`;
                            sortedUsers.forEach(([username, count]) => {
                                const userBlock = document.querySelector(`.block[data-username="${username}"]`);
                                const profileUrl = userBlock
                                    ? userBlock.querySelector('#pfp').src
                                    : 'https://lastfm.freetls.fastly.net/i/u/300x300/5c66a0d6f81115c6d551493c9298b43b.png';
                                html += `
                                    <div style="display:flex;align-items:center;margin:2px 0">
                                        <img src="${profileUrl}" style="width:16px;height:16px;border-radius:50%;margin-right:6px;flex-shrink:0">
                                        <span>${username}: ${count.toLocaleString()}</span>
                                    </div>`;
                            });
                        }

                        // Build albums tooltip content
                        if (sortedAlbums.length > 0) {
                            html += `<div style="margin:5px 0 3px;opacity:0.6;font-size:10px;text-transform:uppercase;letter-spacing:0.5px">Top Albums</div>`;
                            sortedAlbums.forEach(([, album]) => {
                                html += `
                                    <div style="display:flex;align-items:center;margin:2px 0;gap:6px">
                                        <img src="${album.img}" style="width:20px;height:20px;border-radius:2px;flex-shrink:0;object-fit:cover">
                                        <div style="flex:1;min-width:0">
                                            <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${album.name}</div>
                                            <div style="opacity:0.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${album.artist}</div>
                                        </div>
                                        <div style="flex-shrink:0;text-align:center">${album.plays.toLocaleString()}</div>
                                    </div>`;
                            });
                        }

                        const tooltipEl = document.createElement('div');
                        tooltipEl.style.cssText = 'background:rgba(0,0,0,0.8);border-radius:4px;color:white;pointer-events:none;position:absolute;padding:6px;min-width:180px;max-width:260px;font-size:12px;z-index:1000;visibility:hidden';
                        tooltipEl.innerHTML = html;

                        const existing = document.querySelector('.chart-tooltip');
                        if (existing) existing.remove();
                        tooltipEl.classList.add('chart-tooltip');
                        document.body.appendChild(tooltipEl);

                        // Position tooltip
                        const tooltipHeight = tooltipEl.offsetHeight;
                        tooltipEl.style.visibility = '';

                        const position = context.chart.canvas.getBoundingClientRect();
                        const caretX = context.tooltip.caretX;
                        const caretY = context.tooltip.caretY;
                        const tooltipWidth = 260;

                        const fitsAbove = (position.top + caretY - 40) >= tooltipHeight;

                        if (fitsAbove) {
                            let leftPx = position.left + caretX - tooltipWidth / 2;
                            leftPx = Math.max(4, Math.min(leftPx, window.innerWidth - tooltipWidth - 4));
                            tooltipEl.style.left = leftPx + 'px';
                            tooltipEl.style.top = (position.top + caretY + window.scrollY - 40) + 'px';
                            tooltipEl.style.transform = 'translateY(-100%)';
                        } else {
                            const leftPx = Math.max(4, position.left + caretX - tooltipWidth - 12);
                            tooltipEl.style.left = leftPx + 'px';
                            tooltipEl.style.top = (position.top + caretY + window.scrollY - tooltipHeight / 2) + 'px';
                            tooltipEl.style.transform = 'none';
                        }

                        // Add event listeners to remove tooltip
                        const removeTooltip = () => {
                            document.querySelector('.chart-tooltip')?.remove();
                            window.removeEventListener('mousemove', handleMouseMove);
                            window.removeEventListener('scroll', removeTooltip);
                            window.removeEventListener('touchmove', removeTooltip);
                        };
                        const handleMouseMove = (e) => {
                            const rect = context.chart.canvas.getBoundingClientRect();
                            if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
                                removeTooltip();
                            }
                        };
                        window.addEventListener('mousemove', handleMouseMove);
                        window.addEventListener('scroll', removeTooltip, { passive: true });
                        window.addEventListener('touchmove', removeTooltip, { passive: true });
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.4)',
                        maxRotation: 0,
                        font: { size: 10 },
                        callback(value, index, ticks) {
                            const label = this.getLabelForValue(value);
                            const year = parseInt(label);
                            const isLast = index === ticks.length - 1;
                            return (isLast || year % 10 === 0) ? label : null;
                        }
                    },
                    border: { display: false }
                },
                y: {
                    beginAtZero: true,
                    grid: { display: false },
                    ticks: { display: false },
                    border: { display: false }
                }
            },
            animation: { duration: 500 }
        }
    });
}