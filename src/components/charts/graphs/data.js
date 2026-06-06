// Charts - Graphs
import { hourlyChart, dailyChart, createHourlyChart, createDailyChart, decadeChart, createDecadeChart, yearChart, createYearChart, computeHourlyColors, computeHourlyBorderColors, computeHourlyHoverColors, computeDecadeColors, computeDecadeBorderColors } from "./graphs.js";

// Charts - Lists
import { imageCache } from "../lists/lists.js";

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
        hourlyChart.data.datasets[0].backgroundColor = computeHourlyColors(hourlyActivity);
        hourlyChart.data.datasets[0].borderColor = computeHourlyBorderColors(hourlyActivity);
        hourlyChart.data.datasets[0].hoverBackgroundColor = computeHourlyHoverColors(hourlyActivity);
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

export const DECADE_LABELS = ["60s", "70s", "80s", "90s", "00s", "10s", "20s"];
export let decadePlays = new Array(7).fill(0);
export let decadeUsers  = Array.from({ length: 7 }, () => new Map());
export let decadeAlbums = Array.from({ length: 7 }, () => new Map());

function yearToDecadeIndex(year) {
    const y = parseInt(year);
    if (isNaN(y) || y < 1960) return -1;
    return Math.min(Math.floor((y - 1960) / 10), 6);
}

// Group album plays by decade
export function computeDecadeData(chartDataPerUser, albumReleaseYears) {
    decadePlays.fill(0);
    decadeUsers.forEach(m => m.clear());
    decadeAlbums.forEach(m => m.clear());

    Object.entries(chartDataPerUser).forEach(([username, userData]) => {
        Object.entries(userData.albumPlays).forEach(([albumKey, albumData]) => {
            const ryKey = `${albumData.artistName}::${albumData.albumName}`;
            const idx = yearToDecadeIndex(albumReleaseYears[ryKey]);
            if (idx === -1) return;

            const plays = albumData.plays;
            decadePlays[idx] += plays;
            decadeUsers[idx].set(username, (decadeUsers[idx].get(username) || 0) + plays);
            const prev = decadeAlbums[idx].get(albumKey);
            // Album image cache to avoid blank images that Last.fm gives
            const cacheKey = `album-img:${albumData.artistName}::${albumData.albumName}`;
            const isBlank = albumData.img === 'https://lastfm.freetls.fastly.net/i/u/64s/2a96cbd8b46e442fc41c2b86b821562f.png';
            const img = isBlank ? (imageCache.get(cacheKey) ?? null) : albumData.img;
            if (!isBlank) imageCache.set(cacheKey, albumData.img);
            decadeAlbums[idx].set(albumKey, {
                name: albumData.albumName,
                artist: albumData.artistName,
                img,
                plays: (prev?.plays || 0) + plays
            });
        });
    });

    if (decadeChart) {
        decadeChart.data.datasets[0].data = [...decadePlays];
        decadeChart.data.datasets[0].backgroundColor = computeDecadeColors([...decadePlays]);
        decadeChart.data.datasets[0].borderColor = computeDecadeBorderColors([...decadePlays]);
        decadeChart.update();
    } else {
        createDecadeChart();
    }
}

export let yearPlays  = new Map();
export let yearUsers  = new Map();
export let yearAlbums = new Map();

// Group album plays by year
export function computeYearData(chartDataPerUser, albumReleaseYears) {
    yearPlays.clear();
    yearUsers.clear();
    yearAlbums.clear();

    Object.entries(chartDataPerUser).forEach(([username, userData]) => {
        Object.entries(userData.albumPlays).forEach(([albumKey, albumData]) => {
            const ryKey = `${albumData.artistName}::${albumData.albumName}`;
            const y = parseInt(albumReleaseYears[ryKey]);
            if (isNaN(y) || y < 1960) return;
            const year = String(y);
            const plays = albumData.plays;

            yearPlays.set(year, (yearPlays.get(year) || 0) + plays);

            if (!yearUsers.has(year)) yearUsers.set(year, new Map());
            yearUsers.get(year).set(username, (yearUsers.get(year).get(username) || 0) + plays);

            if (!yearAlbums.has(year)) yearAlbums.set(year, new Map());
            const am = yearAlbums.get(year);
            const prev = am.get(albumKey);
            // Album image cache to avoid blank images that Last.fm gives
            const cacheKey = `album-img:${albumData.artistName}::${albumData.albumName}`;
            const isBlank = albumData.img === 'https://lastfm.freetls.fastly.net/i/u/64s/2a96cbd8b46e442fc41c2b86b821562f.png';
            const img = isBlank ? (imageCache.get(cacheKey) ?? null) : albumData.img;
            if (!isBlank) imageCache.set(cacheKey, albumData.img);
            am.set(albumKey, { name: albumData.albumName, artist: albumData.artistName, img, plays: (prev?.plays || 0) + plays });
        });
    });

    const playYears = [...yearPlays.keys()].map(Number);
    const minYear = playYears.length ? Math.min(...playYears) : 1960;
    const maxYear = new Date().getFullYear();

    const sortedYears = [];
    const sortedPlays = [];
    for (let y = minYear; y <= maxYear; y++) {
        const key = String(y);
        sortedYears.push(key);
        sortedPlays.push(yearPlays.get(key) || 0);
    }

    if (yearChart) {
        yearChart.data.labels = sortedYears;
        yearChart.data.datasets[0].data = sortedPlays;
        yearChart.update();
    } else {
        createYearChart(sortedYears, sortedPlays);
    }
}