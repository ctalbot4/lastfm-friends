// State
import { store } from '../../state/store.js';

// API
import * as lastfm from '../../api/lastfm.js';

// Cache
import { cachePlays, getCachedPlays, cacheSortedData, getCachedSortedData } from '../cache.js';

// Charts - Ticker
import { updateTickerDisplay } from './ticker.js';

// Charts - Pages
import { pageState, displayPage } from './pages.js';

// UI
import { updateProgress, updateProgressText } from '../../ui/progress.js';

export let userStats = {};

// Store sorted data for charts
export let sortedData = {
    artists: [],
    albums: [],
    tracks: [],
    listeners: [],
    'unique-artists': [],
    'unique-tracks': []
};

export let trackData = {};
export let userListeningTime = {};

// Tiebreaker for chart rankings
function pseudoHash(str) {
    return str.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

// Update charts and ticker
export async function updateCharts(useCache = false) {
    let artistPlays = null;
    let albumPlays = null;
    let trackPlays = null;

    // If using cache, just load trackPlays and return
    if (useCache) {
        const cachedPlays = await getCachedPlays();
        if (cachedPlays) {
            trackData = cachedPlays.trackPlays;
            userListeningTime = cachedPlays.userListeningTime;
            store.foundTickerCache = true;
        }
        const cachedSortedData = await getCachedSortedData();
        if (cachedSortedData) {
            sortedData = cachedSortedData;
            
            // Update page state from cached data
            pageState.artists.totalItems = sortedData.artists?.length || 0;
            pageState.albums.totalItems = sortedData.albums?.length || 0;
            pageState.tracks.totalItems = sortedData.tracks?.length || 0;
            pageState.listeners.totalItems = sortedData.listeners?.length || 0;
            pageState['unique-artists'].totalItems = sortedData['unique-artists']?.length || 0;
            pageState['unique-tracks'].totalItems = sortedData['unique-tracks']?.length || 0;
            
            // Reset to page 1
            pageState.artists.currentPage = 1;
            pageState.albums.currentPage = 1;
            pageState.tracks.currentPage = 1;
            pageState.listeners.currentPage = 1;
            pageState['unique-artists'].currentPage = 1;
            pageState['unique-tracks'].currentPage = 1;
            
            // Display first page of each list
            await displayPage('artists');
            await displayPage('albums');
            await displayPage('tracks');
            await displayPage('listeners');
            await displayPage('unique-artists');
            await displayPage('unique-tracks');
        }
        return;
    }

    // Only fetch if data wasn't provided
    if (!artistPlays || !albumPlays || !trackPlays) {
        artistPlays = {};
        albumPlays = {};
        trackPlays = {};
        userListeningTime = {};

        const blockContainer = document.getElementById("block-container");
        const blocks = blockContainer.getElementsByClassName("block");
        const blocksArr = Array.from(blocks);
        store.completed = 0;
        store.isUpdatingCharts = true;
        store.isFetchingCharts = true;
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
    updateProgressText();

    sortedData.artists = Object.entries(artistPlays).sort((a, b) => {
        const aScore = b[1].userCount * b[1].cappedPlays;
        const bScore = a[1].userCount * a[1].cappedPlays;
        if (aScore !== bScore) {
            return aScore - bScore;
        }
        return pseudoHash(a[0]) - pseudoHash(b[0]);
    });
    sortedData.albums = Object.entries(albumPlays).sort((a, b) => {
        const aScore = b[1].userCount * b[1].cappedPlays;
        const bScore = a[1].userCount * a[1].cappedPlays;
        if (aScore !== bScore) {
            return aScore - bScore;
        }
        return pseudoHash(a[0]) - pseudoHash(b[0]);
    });
    sortedData.tracks = Object.entries(trackPlays).sort((a, b) => {
        const aScore = b[1].userCount * b[1].cappedPlays;
        const bScore = a[1].userCount * a[1].cappedPlays;
        if (aScore !== bScore) {
            return aScore - bScore;
        }
        return pseudoHash(a[0]) - pseudoHash(b[0]);
    });

    store.isFetchingCharts = false;

    updateTickerDisplay(sortedData.artists, sortedData.albums, sortedData.tracks);

    // Wait for blocks to finish updating
    while (store.isUpdatingBlocks) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Update lists
    sortedData.listeners = Object.entries(userListeningTime)
        .sort((a, b) => b[1] - a[1]);
    
    sortedData['unique-artists'] = Object.entries(userStats)
        .filter(([username, stats]) => stats.totalArtists > 0)
        .sort((a, b) => b[1].totalArtists - a[1].totalArtists);
    
    sortedData['unique-tracks'] = Object.entries(userStats)
        .filter(([username, stats]) => stats.totalTracks > 0)
        .sort((a, b) => b[1].totalTracks - a[1].totalTracks);

    pageState.artists.totalItems = sortedData.artists.length;
    pageState.albums.totalItems = sortedData.albums.length;
    pageState.tracks.totalItems = sortedData.tracks.length;
    pageState.listeners.totalItems = sortedData.listeners.length;
    pageState['unique-artists'].totalItems = sortedData['unique-artists'].length;
    pageState['unique-tracks'].totalItems = sortedData['unique-tracks'].length;

    await displayPage('artists');
    await displayPage('albums');
    await displayPage('tracks');
    await displayPage('listeners');
    await displayPage('unique-artists');
    await displayPage('unique-tracks');

    store.updateTimers.charts.lastUpdate = Date.now();

    cachePlays(trackPlays, userListeningTime);
    cacheSortedData(sortedData);

    trackData = trackPlays;

    store.isUpdatingCharts = false;
}

export async function fetchArtists(block, artistPlays, key = store.keys.KEY, retry = false) {
    const username = block.dataset.username;
    try {
        const data = await lastfm.getTopArtists(username, key);
        updateProgress("artists", username);
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
    } catch (error) {
        if (error.data) {
            console.error(`API error ${error.data.error} for user ${username}'s artists:`, error.data.message);
            if (error.data?.error === 8 && retry === false) {
                return fetchArtists(block, artistPlays, key, true);
            } else if (error.data?.error === 29) {
                gtag('event', 'rate_limit-general', {});
            }
        } else {
            console.error(`Error fetching user artist data for ${username}:`, error);
        }
    }
}

export async function fetchAlbums(block, albumPlays, key = store.keys.KEY, retry = false) {
    const username = block.dataset.username;
    try {
        const data = await lastfm.getTopAlbums(username, key);
        updateProgress("albums", username);
        data.topalbums.album.forEach(album => {
            const plays = parseInt(album.playcount);
            const cappedPlays = Math.min(plays, 300);
            const url = album.url;
            const artist = album.artist.name;
            const artistUrl = album.artist.url;
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
                    artistUrl,
                    img: album.image[1]["#text"],
                    userCount: 0,
                    users: {}
                };
            }
            albumPlays[key].users[username] = plays;
            albumPlays[key].userCount++;
        });
    } catch (error) {
        if (error.data) {
            console.error(`API error ${error.data.error} for user ${username}'s albums:`, error.data.message);
            if (error.data?.error === 8 && retry === false) {
                return fetchAlbums(block, albumPlays, key, true);
            } else if (error.data?.error === 29) {
                gtag('event', 'rate_limit-general', {});
            }
        } else {
            console.error(`Error fetching user album data for ${username}:`, error);
        }
    }
}

export async function fetchTracks(block, trackPlays, key = store.keys.KEY, retry = false) {
    const username = block.dataset.username;
    try {
        let data = await lastfm.getTopTracks(username, key);
        updateProgress("tracks", username);
        const totalTracks = parseInt(data.toptracks["@attr"].total);
        const totalPages = parseInt(data.toptracks["@attr"].totalPages);

        for (let page = 1; page <= totalPages && page <= 5; page++) {
            if (page > 1) {
                data = await lastfm.getTopTracks(username, key, page);
            }
            data.toptracks.track.forEach(track => {
                const plays = parseInt(track.playcount);
                const cappedPlays = Math.min(plays, 30);
                const trackUrl = track.url;
                const artistUrl = track.artist.url;
                const artist = track.artist.name;
                const trackName = track.name;

                // If no duration data, default to 220 seconds
                const duration = parseInt(track.duration) || 220;

                userListeningTime[username] = (userListeningTime[username] || 0) + (duration * plays);

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
        }

        userStats[username] = {
            ...userStats[username],
            totalTracks
        };
    } catch (error) {
        if (error.data) {
            console.error(`API error ${error.data.error} for user ${username}'s tracks:`, error.data.message);
            if (error.data?.error === 8 && retry === false) {
                return fetchTracks(block, trackPlays, key, true);
            } else if (error.data?.error === 29) {
                gtag('event', 'rate_limit-general', {});
            }
        } else {
            console.error(`Error fetching user track data for ${username}:`, error);
        }
    }
}