// State
import { store } from '../../state/store.js';

// API
import * as lastfm from '../../api/lastfm.js';

// Cache
import { cacheCharts } from '../cache.js';

// UI
import { updateProgress } from '../../ui/progress.js';

// Components
import { createArtistCharts, createAlbumCharts, createTrackCharts } from './charts.js';

export async function fetchArtists(block, artistPlays, key = store.keys.KEY) {
    const username = block.dataset.username;
    try {
        const data = await lastfm.getTopArtists(username, key);
        data.topartists.artist.forEach(artist => {
            const plays = parseInt(artist.playcount);
            const cappedPlays = Math.min(plays, 800);
            const url = artist.url;
            if (artistPlays[artist.name]) {
                artistPlays[artist.name].plays += plays;
                artistPlays[artist.name].cappedPlays += cappedPlays;
            } else {
                artistPlays[artist.name] = {
                    plays,
                    cappedPlays,
                    url,
                    userCount: 0,
                    users: {}
                };
            }
            artistPlays[artist.name].users[username] = plays;
            artistPlays[artist.name].userCount++;
        });
        updateProgress();
    } catch (error) {
        console.error("Error fetching user artist data:", error);
    }
}

export async function fetchAlbums(block, albumPlays, key = store.keys.KEY) {
    const username = block.dataset.username;
    try {
        const data = await lastfm.getTopAlbums(username, key);
        data.topalbums.album.forEach(album => {
            const plays = parseInt(album.playcount);
            const cappedPlays = Math.min(plays, 300);
            const url = album.url;
            const artist = album.artist.name;
            const albumName = album.name;

            const key = `${albumName}::${artist}`;
            if (albumPlays[key]) {
                albumPlays[key].plays += plays;
                albumPlays[key].cappedPlays += cappedPlays;
            } else {
                albumPlays[key] = {
                    artist,
                    albumName,
                    plays,
                    cappedPlays,
                    url,
                    img: album.image[1]["#text"],
                    userCount: 0,
                    users: {}
                };
            }
            albumPlays[key].users[username] = plays;
            albumPlays[key].userCount++;
        });
        updateProgress();
    } catch (error) {
        console.error("Error fetching user album data:", error);
    }
}

export async function fetchTracks(block, trackPlays, key = store.keys.KEY) {
    const username = block.dataset.username;
    try {
        const data = await lastfm.getTopTracks(username, key);
        data.toptracks.track.forEach(track => {
            const plays = parseInt(track.playcount);
            const cappedPlays = Math.min(plays, 30);
            const trackUrl = track.url;
            const artistUrl = track.artist.url;
            const artist = track.artist.name;
            const trackName = track.name;

            const key = `${trackName}::${artist}`;

            if (trackPlays[key]) {
                trackPlays[key].plays += plays;
                trackPlays[key].cappedPlays += cappedPlays;
            } else {
                trackPlays[key] = {
                    artist,
                    trackName,
                    plays,
                    cappedPlays,
                    trackUrl,
                    artistUrl,
                    userCount: 0,
                    users: {}
                };
            }
            trackPlays[key].users[username] = plays;
            trackPlays[key].userCount++;
        });
        updateProgress();
    } catch (error) {
        console.error("Error fetching user track data:", error);
    }
}

function updateTickerDisplay(sortedArtistPlays, sortedAlbumPlays, sortedTrackPlays) {
    // Update artist ticker
    document.querySelectorAll(".ticker-artist > .value > a").forEach(element => {
        element.innerText = sortedArtistPlays[0][0];
    });
    document.querySelectorAll(".ticker-artist > .subtext").forEach(element => {
        element.innerText = `(${sortedArtistPlays[0][1].plays} plays)`;
    });
    document.querySelectorAll(".ticker-artist > .value > a").forEach(element => {
        element.href = sortedArtistPlays[0][1].url;
    });

    // Update album ticker
    document.querySelectorAll(".ticker-album > .value > a").forEach(element => {
        element.innerText = sortedAlbumPlays[0][1].albumName;
    });
    document.querySelectorAll(".ticker-album > .subtext").forEach(element => {
        element.innerText = `(${sortedAlbumPlays[0][1].plays} plays)`;
    });
    document.querySelectorAll(".ticker-album > .value > a").forEach(element => {
        element.href = sortedAlbumPlays[0][1].url;
    });

    // Update track ticker
    document.querySelectorAll(".ticker-track > .value > a").forEach(element => {
        element.innerText = sortedTrackPlays[0][1].trackName;
    });
    document.querySelectorAll(".ticker-track> .subtext").forEach(element => {
        element.innerText = `(${sortedTrackPlays[0][1].plays} plays)`;
    });
    document.querySelectorAll(".ticker-track > .value > a").forEach(element => {
        element.href = sortedTrackPlays[0][1].trackUrl;
    });
}
// Update ticker (other than now playing, plays)
export async function updateTicker() {
    const artistPlays = {};
    const albumPlays = {};
    const trackPlays = {};

    const blockContainer = document.getElementById("block-container");
    const blocks = blockContainer.getElementsByClassName("block");
    const blocksArr = Array.from(blocks);
    store.completed = 0;
    const chunks = [];

    // Fetch first chunk
    chunks.push(blocksArr.slice(0, 250));
    const artistPromises = Array.from(chunks[0]).map(block => fetchArtists(block, artistPlays));
    const albumPromises = Array.from(chunks[0]).map(block => fetchAlbums(block, albumPlays));
    const trackPromises = Array.from(chunks[0]).map(block => fetchTracks(block, trackPlays));
    await Promise.all([...artistPromises, ...albumPromises, ...trackPromises]);

    // Fetch second chunk if necessary
    if (store.friendCount > 250) {
        await new Promise(resolve => setTimeout(resolve, 8000));

        chunks.push(blocksArr.slice(250, 500));
        const artistPromises = Array.from(chunks[1]).map(block => fetchArtists(block, artistPlays, store.keys.KEY2));
        const albumPromises = Array.from(chunks[1]).map(block => fetchAlbums(block, albumPlays, store.keys.KEY2));
        const trackPromises = Array.from(chunks[1]).map(block => fetchTracks(block, trackPlays, store.keys.KEY2));

        await Promise.all([...artistPromises, ...albumPromises, ...trackPromises]);
    }

    const sortedArtistPlays = Object.entries(artistPlays).sort((a, b) => (b[1].userCount * b[1].cappedPlays) - (a[1].userCount * a[1].cappedPlays));
    const sortedAlbumPlays = Object.entries(albumPlays).sort((a, b) => (b[1].userCount * b[1].cappedPlays) - (a[1].userCount * a[1].cappedPlays));
    const sortedTrackPlays = Object.entries(trackPlays).sort((a, b) => (b[1].userCount * b[1].cappedPlays) - (a[1].userCount * a[1].cappedPlays));

    updateTickerDisplay(sortedArtistPlays, sortedAlbumPlays, sortedTrackPlays);

    await Promise.all([
        createArtistCharts(sortedArtistPlays),
        createAlbumCharts(sortedAlbumPlays),
        createTrackCharts(sortedTrackPlays)
    ]);

    store.updateTimers.ticker.lastUpdate = Date.now();
    cacheCharts();

    console.log("Stats refreshed!");
}