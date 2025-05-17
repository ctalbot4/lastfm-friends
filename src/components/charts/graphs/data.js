// "Activity by Day" and "Activity by Hour" charts

// Charts - Graphs
import { hourlyChart, dailyChart, createHourlyChart, createDailyChart } from "./graphs.js";

export const hourlyActivity = new Array(24).fill(0);
const tempHourlyActivity = new Array(24).fill(0);
export const hourlyListeners = Array.from({ length: 24 }, () => new Map());
const tempHourlyListeners = Array.from({ length: 24 }, () => new Map());

export const dailyActivity = new Array(7).fill(0);
const tempDailyActivity = new Array(7).fill(0);
export const dailyListeners = Array.from({ length: 7 }, () => new Map());
const tempDailyListeners = Array.from({ length: 7 }, () => new Map());

// Clear temporary data variables after chart update
export function resetActivityData() {
    tempHourlyActivity.fill(0);
    tempDailyActivity.fill(0);
    tempHourlyListeners.forEach(listeners => listeners.clear());
    tempDailyListeners.forEach(listeners => listeners.clear());
}

// Update data with a user's plays
export function updateActivityData(tracks, username) {
    tracks.forEach(track => {
        if (track.date?.uts) {
            const date = new Date(track.date?.uts * 1000);
            const hour = date.getHours();
            const day = date.getDay();

            tempHourlyActivity[hour]++;
            const hourlyListenersMap = tempHourlyListeners[hour];
            hourlyListenersMap.set(username, (hourlyListenersMap.get(username) || 0) + 1);

            tempDailyActivity[day]++;
            const dailyListenersMap = tempDailyListeners[day];
            dailyListenersMap.set(username, (dailyListenersMap.get(username) || 0) + 1);
        }
    });
}

// Copy temporary data then update activity charts
export function updateActivityCharts() {
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

    if (hourlyChart) {
        hourlyChart.data.datasets[0].data = hourlyActivity;
        hourlyChart.update();
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