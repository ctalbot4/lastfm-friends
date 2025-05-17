// "Every Play From Every Friend" chart

// State
import { store } from "../../../state/store.js";

// Charts - Scatter
import { scatterChart, createScatterPlot, getCurrentTimeDataset } from "./scatter.js";

// Constants
const DAY_WIDTH = 100;
const BUCKET_SIZE = 4;
const MIN_DOT_RADIUS = .5;
const MAX_DOT_RADIUS = 1.5;

// Buckets for scatter plot
export let buckets = {};
let tempBuckets = {};

export let pendingScatterUpdate = false;

// Helper functions
const minuteOfDay = d => d.getHours() * 60 + d.getMinutes() + (d.getSeconds() / 60);
const dayOfWeek = d => d.getDay();

const artistColors = new Map();

// Colors for top 10 artists
const TOP_ARTIST_COLORS = [
    '#FF3B30', // bright red
    '#FF9500', // orange
    '#FFCC00', // yellow
    '#66E01D', // light green
    '#00C7BE', // aqua / teal
    '#007AFF', // vivid blue
    '#5856D6', // purple
    '#AF52DE', // violet
    '#FF2D92', // pink
];

function getArtistColor(artist) {
    if (!artistColors.has(artist)) {
        const colorIndex = artistColors.size % TOP_ARTIST_COLORS.length;
        artistColors.set(artist, TOP_ARTIST_COLORS[colorIndex]);
    }
    return artistColors.get(artist);
}

// Reset temporary data
export function resetScatterData() {
    tempBuckets = {};
}

// Process and store track data
export function updateScatterData(tracks, username) {
    // Process tracks directly into buckets
    tracks.forEach(track => {
        if (!track.date?.uts) return;

        const date = new Date(parseInt(track.date.uts) * 1000);
        const minute = minuteOfDay(date);
        const day = date.getDate();
        const bucketMinute = Math.floor(minute / BUCKET_SIZE) * BUCKET_SIZE;
        const key = `${day}-${bucketMinute}`;

        if (!tempBuckets[key]) {
            tempBuckets[key] = [];
        }

        // Limit to 3 plays per user per bucket
        const userPlaysInBucket = tempBuckets[key].filter(play => play.username === username).length;
        if (userPlaysInBucket < 3) {
            tempBuckets[key].push({
                timestamp: parseInt(track.date.uts),
                username,
                track: track.name,
                artist: track.artist.name,
                image: track.image?.[2]['#text'] || 'https://lastfm.freetls.fastly.net/i/u/64s/c6f59c1e5e7240a4c0d427abd71f3dbb.jpg'
            });
        }
    });

    pendingScatterUpdate = true;
}

// Update scatter plot if conditions allow
export function tryScatterUpdate() {
    if (pendingScatterUpdate && !store.isUpdatingBlocks &&
        !document.getElementById('charts').classList.contains('collapsed')) {
        updateScatterPlot();
    }
}

// Update scatter plot with stored data
function updateScatterPlot() {
    if (!scatterChart) {
        createScatterPlot();
    }

    // Keep axis and separator datasets
    const stubDataset = scatterChart.data.datasets.find(d => d.label === 'axis-stub');
    const separatorDatasets = scatterChart.data.datasets.filter(d => d.label === 'day-divider');
    scatterChart.data.datasets = [...separatorDatasets, stubDataset];

    // Get all usernames from the buckets
    const usernames = new Set();
    Object.values(tempBuckets).forEach(plays => {
        plays.forEach(play => usernames.add(play.username));
    });

    // Calculate dot radius based on max bucket size
    const maxBucketSize = Math.max(...Object.values(tempBuckets).map(plays => plays.length), 1);
    const radius = Math.max(
        MIN_DOT_RADIUS,
        Math.min(MAX_DOT_RADIUS, 0.5 + (4 / Math.sqrt(maxBucketSize)))
    );

    // Get top 10 artists
    const artistCounts = new Map();
    Object.values(tempBuckets).forEach(plays => {
        plays.forEach(play => {
            artistCounts.set(play.artist, (artistCounts.get(play.artist) || 0) + 1);
        });
    });
    const topArtists = Array.from(artistCounts.entries())
        .sort((a, b) => {
            if (b[1] !== a[1]) {
                return b[1] - a[1];
            }
            return a[0].localeCompare(b[0]);
        })
        .slice(0, 9)
        .map(([artist]) => artist);

    // Create datasets for top artists, other artists
    const datasets = new Map();
    topArtists.forEach(artist => {
        datasets.set(artist, {
            label: artist,
            data: [],
            pointRadius: usernames.length > 25 ? 1.5 * radius : radius,
            pointStyle: 'circle',
            showLine: false,
            backgroundColor: getArtistColor(artist),
            order: 1
        });
    });
    datasets.set('Other Artists', {
        label: 'Other Artists',
        data: [],
        pointRadius: radius,
        pointStyle: 'circle',
        showLine: false,
        backgroundColor: 'rgba(128, 128, 128, 0.4)',
        order: 2
    });

    // Use jittering for friend count > 25
    if (Array.from(usernames).length > 25) {
        Object.entries(tempBuckets).forEach(([key, plays]) => {
            // Sort plays within bucket
            const sortedPlays = plays.sort((a, b) => {
                const aRank = topArtists.indexOf(a.artist);
                const bRank = topArtists.indexOf(b.artist);

                if (aRank !== -1 && bRank !== -1) {
                    if (aRank !== bRank) return aRank - bRank;
                    const nameCmp = a.username.localeCompare(b.username);
                    if (nameCmp !== 0) {
                        return nameCmp;
                    }
                    const imgCmp = b.image.localeCompare(a.image);
                    if (imgCmp !== 0) return imgCmp;
                    return a.timestamp - b.timestamp;
                }

                if (aRank !== -1) return -1;
                if (bRank !== -1) return 1;

                const nameCmp = a.username.localeCompare(b.username);
                if (nameCmp !== 0) return nameCmp;
                const imgCmp = b.image.localeCompare(a.image);
                if (imgCmp !== 0) return imgCmp;
                return a.timestamp - b.timestamp;
            });

            // Add points in each bucket with jittering
            sortedPlays.forEach((play, i) => {
                const date = new Date(play.timestamp * 1000);
                const dayOffset = dayOfWeek(date) * DAY_WIDTH;

                const ring = Math.floor((i + 1) / 2);
                const sign = i % 2 === 0 ? 1 : -1;
                const offset = sign * ring * (DAY_WIDTH / (maxBucketSize + 1));
                const xPos = dayOffset + offset;

                const point = {
                    x: xPos,
                    y: minuteOfDay(date),
                    user: play.username,
                    track: play.track,
                    artist: play.artist,
                    timestamp: play.timestamp,
                    bucketKey: key,
                    image: play.image
                };

                const dataset = datasets.get(topArtists.includes(play.artist) ? play.artist : 'Other Artists');
                dataset.data.push(point);
            });
        });
    }
    // Plot by user for friend count <= 25
    else {
        const sortedUsernames = Array.from(usernames).sort((a, b) => a.localeCompare(b));
        sortedUsernames.forEach((username, userIndex) => {
            Object.entries(tempBuckets).forEach(([key, plays]) => {
                plays.forEach((play, i) => {
                    if (play.username === username) {
                        const date = new Date(play.timestamp * 1000);
                        const dayOffset = dayOfWeek(date) * DAY_WIDTH;

                        const sign = userIndex % 2 === 0 ? 1 : -1;
                        const userOffset = 0.6 * sign * Math.floor((userIndex + 1) / 2) * Math.min(10, DAY_WIDTH / (sortedUsernames.length + 1));
                        const xPos = dayOffset + userOffset;

                        const point = {
                            x: xPos,
                            y: minuteOfDay(date),
                            user: play.username,
                            track: play.track,
                            artist: play.artist,
                            timestamp: play.timestamp,
                            bucketKey: key,
                            image: play.image
                        };

                        const dataset = datasets.get(topArtists.includes(play.artist) ? play.artist : 'Other Artists');
                        dataset.data.push(point);
                    }
                });
            });
        });
    }

    scatterChart.data.datasets.push(...Array.from(datasets.values()));
    buckets = tempBuckets;

    // Somewhat of a hack to stop last tooltip from reappearing
    scatterChart._lastEvent = null;
    scatterChart.setActiveElements([]);
    scatterChart.tooltip.setActiveElements([], {
        x: 0,
        y: 0
    });

    // Update time line
    scatterChart.data.datasets = scatterChart.data.datasets.filter(
        d => d.label !== 'current-time'
    );
    scatterChart.data.datasets.unshift(getCurrentTimeDataset());

    scatterChart.update();
    tempBuckets = {};
    pendingScatterUpdate = false;
}