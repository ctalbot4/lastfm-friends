// State
import { store } from '../../state/store.js';

// API
import * as lastfm from '../../api/lastfm.js';

// Blocks - Update
import { userPlayCounts } from '../blocks/update.js';

// Cache
import { cachePlays, getCachedPlays, cacheSortedData, getCachedSortedData, cacheListening } from '../cache.js';

// Charts - Ticker
import { updateTickerDisplay } from './ticker.js';

// Charts - Pages
import { pageState, displayPage } from './pages.js';

// UI
import { updateProgress } from '../../ui/progress.js';

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

export function setUserListeningTime(listeningTime) {
    userListeningTime = listeningTime;
}

export let chartDataPerUser = {};

// Calculate top artists, albums, and tracks from recent track data
export function calculateChartData(tracks, username) {

    const userArtists = {};
    const userAlbums = {};
    const userTracks = {};
    
    // Count plays for each track, artist, and album
    tracks.forEach(track => {
        if (!track.date?.uts) return; // Skip now playing tracks
        
        const trackName = track.name.trim();
        const artistName = track.artist.name;
        const albumName = track.album?.["#text"];

        // Count artists
        const artistUrl = track.artist.url;
        if (userArtists[artistName]) {
            userArtists[artistName].plays += 1;
        } else {
            userArtists[artistName] = {
                plays: 1,
                artistUrl
            };
        }

        // Count albums
        if (albumName) {
            const albumUrl = `${artistUrl}/${encodeURIComponent(albumName).replace(/%20/g, '+')}`;
            const key = `${albumName}::${artistName}`;
            if (userAlbums[key]) {
                userAlbums[key].plays += 1;
            } else {
                userAlbums[key] = {
                    artistName,
                    albumName,
                    plays: 1,
                    artistUrl,
                    albumUrl,
                    img: track.image[1]["#text"]
                };
            }
        }

        // Count tracks
        const trackKey = `${trackName}::${artistName}`;
        const trackUrl = track.url;

        if (userTracks[trackKey]) {
            userTracks[trackKey].plays += 1;
        } else {
            userTracks[trackKey] = {
                artistName,
                trackName,
                plays: 1,
                trackUrl,
                artistUrl
            };
        }
    });

    chartDataPerUser[username] = {
        artistPlays: userArtists,
        albumPlays: userAlbums,
        trackPlays: userTracks
    };
}

// Calculate listening time for users using top tracks API (needed for duration data)
export async function calculateListeningTime() {
    store.isUpdatingListening = true;

    userListeningTime = {};

    const blockContainer = document.getElementById("block-container");
    const blocks = blockContainer.getElementsByClassName("block");
    const blocksArr = Array.from(blocks);
    
    const chunks = [];
    chunks.push(blocksArr.slice(0, 250));
    
    // Fetch listening time for first chunk
    const listeningPromises = Array.from(chunks[0]).map(block => fetchListeningTime(block));
    await Promise.all(listeningPromises);
    
    // Fetch second chunk if necessary
    if (store.friendCount > 250) {
        await new Promise(resolve => setTimeout(resolve, 8000));
        chunks.push(blocksArr.slice(250, 500));
        const listeningPromises = Array.from(chunks[1]).map(block => fetchListeningTime(block, store.keys.KEY2));
        await Promise.all(listeningPromises);
    }

    displayPage("listeners");

    store.updateTimers.listening.lastUpdate = Date.now();
    store.isUpdatingListening = false;

    cacheListening(userListeningTime, userPlayCounts);
}

// Fetch listening time for a single user
export async function fetchListeningTime(block, key = store.keys.KEY) {
    const username = block.dataset.username;
    try {
        let data = await lastfm.getTopTracks(username, key);
        const totalTracks = parseInt(data.toptracks["@attr"].total);
        const totalPages = parseInt(data.toptracks["@attr"].totalPages);

        for (let page = 1; page <= totalPages && page <= 5; page++) {
            if (page > 1) {
                data = await lastfm.getTopTracks(username, key, page);
            }
            data.toptracks.track.forEach(track => {
                const plays = parseInt(track.playcount);
                // If no duration data, default to 220 seconds
                const duration = parseInt(track.duration) || 220;
                userListeningTime[username] = (userListeningTime[username] || 0) + (duration * plays);
            });
        }
    } catch (error) {
        console.error(`Error fetching listening time for ${username}:`, error);
    } finally {
        updateProgress("tracks", username);
    }
}

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
            trackData = cachedPlays;
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

    // Process calculated data from each user
    artistPlays = {};
    albumPlays = {};
    trackPlays = {};

    // Process each user's data
    Object.entries(chartDataPerUser).forEach(([username, userData]) => {
        Object.entries(userData.artistPlays).forEach(([artistName, artistData]) => {
        const plays = parseInt(artistData.plays);
        const cappedPlays = Math.min(plays, 800);
        const url = artistData.artistUrl;
        
        if (artistPlays[artistName]) {
            artistPlays[artistName].plays += plays;
            artistPlays[artistName].cappedPlays += cappedPlays;
        } else {
            artistPlays[artistName] = {
                plays,
                cappedPlays,
                url,
                userCount: 0,
                users: {}
            };
        }
            artistPlays[artistName].users[username] = plays;
            artistPlays[artistName].userCount++;
        });
    
        // Process albums
        Object.entries(userData.albumPlays).forEach(([albumKey, albumData]) => {
            const plays = parseInt(albumData.plays);
            const cappedPlays = Math.min(plays, 300);
            const url = albumData.albumUrl;
            const artist = albumData.artistName;
            const artistUrl = albumData.artistUrl;
            const albumName = albumData.albumName;
            
            if (albumPlays[albumKey]) {
                albumPlays[albumKey].plays += plays;
                albumPlays[albumKey].cappedPlays += cappedPlays;
            } else {
                albumPlays[albumKey] = {
                    artist,
                    albumName,
                    plays,
                    cappedPlays,
                    url,
                    artistUrl,
                    img: albumData.img,
                    userCount: 0,
                    users: {}
                };
            }
            albumPlays[albumKey].users[username] = plays;
            albumPlays[albumKey].userCount++;
        });
    
        // Process tracks
        Object.entries(userData.trackPlays).forEach(([trackKey, trackData]) => {
            const plays = parseInt(trackData.plays);
            const cappedPlays = Math.min(plays, 30);
            const trackUrl = trackData.trackUrl;
            const artistUrl = trackData.artistUrl;
            const artist = trackData.artistName;
            const trackName = trackData.trackName;
            
            if (trackPlays[trackKey]) {
                trackPlays[trackKey].plays += plays;
                trackPlays[trackKey].cappedPlays += cappedPlays;
            } else {
                trackPlays[trackKey] = {
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
            trackPlays[trackKey].users[username] = plays;
            trackPlays[trackKey].userCount++;
        });

        userStats[username] = {
            ...userStats[username],
            totalArtists: Object.keys(userData.artistPlays).length,
            totalAlbums: Object.keys(userData.albumPlays).length,
            totalTracks: Object.keys(userData.trackPlays).length
        };
    });
        
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

    // Wait for blocks and listening time to finish updating
    while (store.isUpdatingBlocks || store.isUpdatingListening) {
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

    cacheListening(userListeningTime, userPlayCounts);
    cachePlays(trackPlays);
    cacheSortedData(sortedData);

    trackData = trackPlays;

    store.isUpdatingCharts = false;
}