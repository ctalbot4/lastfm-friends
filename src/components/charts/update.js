// State
import { store } from '../../state/store.js';

// API
import * as lastfm from '../../api/lastfm.js';

// Cache
import { cachePlays, getCachedPlays } from '../cache.js';

// Charts - Lists
import { createAlbumCharts, createArtistCharts, createTrackCharts, createUniqueArtistsChart, createUniqueTracksChart } from './lists/lists.js';

// Charts - Ticker
import { updateTickerDisplay } from './ticker.js';

// UI
import { updateProgress } from '../../ui/progress.js';

export let userStats = {};
export let trackData = {};

// Update charts and ticker
export async function updateCharts(useCache = false) {
    let artistPlays = null;
    let albumPlays = null;
    let trackPlays = null;

    // If using cache, just load trackPlays and return
    if (useCache) {
        const cachedPlays = await getCachedPlays();
        if (cachedPlays) {
            trackData = cachedPlays;
            store.foundTickerCache = true;
        }
        return;
    }

    // Only fetch if data wasn't provided
    if (!artistPlays || !albumPlays || !trackPlays) {
        artistPlays = artistPlays || {};
        albumPlays = albumPlays || {};
        trackPlays = trackPlays || {};

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
        console.log("Stats refreshed!");
    }

    const sortedArtistPlays = Object.entries(artistPlays).sort((a, b) => {
        const aScore = b[1].userCount * b[1].cappedPlays;
        const bScore = a[1].userCount * a[1].cappedPlays;
        if (aScore !== bScore) {
            return aScore - bScore;
        }
        return a[0].localeCompare(b[0]);
    });
    const sortedAlbumPlays = Object.entries(albumPlays).sort((a, b) => {
        const aScore = b[1].userCount * b[1].cappedPlays;
        const bScore = a[1].userCount * a[1].cappedPlays;
        if (aScore !== bScore) {
            return aScore - bScore;
        }
        return a[0].localeCompare(b[0]);
    });
    const sortedTrackPlays = Object.entries(trackPlays).sort((a, b) => {
        const aScore = b[1].userCount * b[1].cappedPlays;
        const bScore = a[1].userCount * a[1].cappedPlays;
        if (aScore !== bScore) {
            return aScore - bScore;
        }
        return a[0].localeCompare(b[0]);
    });

    updateTickerDisplay(sortedArtistPlays, sortedAlbumPlays, sortedTrackPlays);

    while (store.isUpdatingBlocks) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    const [artists, albums, tracks, uniqueArtists, uniqueTracks] = await Promise.all([
        createArtistCharts(sortedArtistPlays),
        createAlbumCharts(sortedAlbumPlays),
        createTrackCharts(sortedTrackPlays),
        createUniqueArtistsChart(),
        createUniqueTracksChart()
    ]);

    const artistsList = document.getElementById("artists-list");
    const albumsList = document.getElementById("albums-list");
    const tracksList = document.getElementById("tracks-list");
    const uniqueArtistsList = document.getElementById("unique-artists-list");
    const uniqueTracksList = document.getElementById("unique-tracks-list");

    artistsList.innerHTML = '';
    albumsList.innerHTML = '';
    tracksList.innerHTML = '';
    uniqueArtistsList.innerHTML = '';
    uniqueTracksList.innerHTML = '';

    artists.forEach(item => artistsList.appendChild(item));
    albums.forEach(item => albumsList.appendChild(item));
    tracks.forEach(item => tracksList.appendChild(item));
    uniqueArtists.forEach(item => uniqueArtistsList.appendChild(item));
    uniqueTracks.forEach(item => uniqueTracksList.appendChild(item));

    store.updateTimers.ticker.lastUpdate = Date.now();

    cachePlays(trackPlays);

    trackData = trackPlays;
}

export async function fetchArtists(block, artistPlays, key = store.keys.KEY) {
    const username = block.dataset.username;
    try {
        const data = await lastfm.getTopArtists(username, key);
        const totalArtists = parseInt(data.topartists["@attr"].total);

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

        userStats[username] = {
            ...userStats[username],
            totalArtists
        };

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
        const totalTracks = parseInt(data.toptracks["@attr"].total);

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

        userStats[username] = {
            ...userStats[username],
            totalTracks
        };

        updateProgress();
    } catch (error) {
        console.error("Error fetching user track data:", error);
    }
}