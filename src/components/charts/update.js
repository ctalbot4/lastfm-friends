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

// Preview
import { audioState } from '../preview/index.js';

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
    'unique-tracks': [],
    'complete-albums': [],
    'artist-streaks': [],
    'album-streaks': [],
    'track-streaks': [],
    'listening-streaks': []
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
    
    // Track streaks using buffers
    let artistStreakBuffer = { current: null, count: 0, startDate: null, endDate: null };
    let albumStreakBuffer = { current: null, count: 0, image: null, startDate: null, endDate: null };
    let trackStreakBuffer = { current: null, count: 0, startDate: null, endDate: null };
    let listeningStreakBuffer = { count: 0, startDate: null, endDate: null, lastTrackDate: null };
    let allArtistStreaks = [];
    let allAlbumStreaks = [];
    let allTrackStreaks = [];
    let allListeningStreaks = [];
    
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

        // Track artist streak
        const trackDate = new Date(track.date.uts * 1000);
        if (artistStreakBuffer.current === artistName) {
            artistStreakBuffer.count++;
            artistStreakBuffer.endDate = trackDate;
        } else {
            // Save completed streak
            if (artistStreakBuffer.count >= 2 && artistStreakBuffer.current) {
                allArtistStreaks.push({
                    username: username,
                    count: artistStreakBuffer.count,
                    name: artistStreakBuffer.current,
                    startDate: artistStreakBuffer.endDate,
                    endDate: artistStreakBuffer.startDate
                });
            }
            artistStreakBuffer.current = artistName;
            artistStreakBuffer.count = 1;
            artistStreakBuffer.startDate = trackDate;
            artistStreakBuffer.endDate = trackDate;
        }
        
        // Track album streak
        const albumKey = albumName ? `${albumName}::${artistName}` : null;
        if (albumStreakBuffer.current === albumKey && albumKey) {
            albumStreakBuffer.count++;
            albumStreakBuffer.endDate = trackDate;
        } else {
            // Save completed streak
            if (albumStreakBuffer.count >= 2 && albumStreakBuffer.current) {
                const [albumName, artistName] = albumStreakBuffer.current.split('::');
                allAlbumStreaks.push({
                    username: username,
                    count: albumStreakBuffer.count,
                    name: albumName,
                    artist: artistName,
                    image: albumStreakBuffer.image,
                    startDate: albumStreakBuffer.endDate,
                    endDate: albumStreakBuffer.startDate
                });
            }
            albumStreakBuffer.current = albumKey;
            albumStreakBuffer.count = albumKey ? 1 : 0;
            albumStreakBuffer.image = albumKey ? track.image[1]["#text"] : null;
            albumStreakBuffer.startDate = albumKey ? trackDate : null;
            albumStreakBuffer.endDate = albumKey ? trackDate : null;
        }
        
        // Track track streak
        const trackStreakKey = `${trackName}::${artistName}`;
        if (trackStreakBuffer.current === trackStreakKey) {
            trackStreakBuffer.count++;
            trackStreakBuffer.endDate = trackDate;
        } else {
            // Save completed streak
            if (trackStreakBuffer.count >= 2 && trackStreakBuffer.current) {
                const [trackName, artistName] = trackStreakBuffer.current.split('::');
                allTrackStreaks.push({
                    username: username,
                    count: trackStreakBuffer.count,
                    name: trackName,
                    artist: artistName,
                    startDate: trackStreakBuffer.endDate,
                    endDate: trackStreakBuffer.startDate
                });
            }
            trackStreakBuffer.current = trackStreakKey;
            trackStreakBuffer.count = 1;
            trackStreakBuffer.startDate = trackDate;
            trackStreakBuffer.endDate = trackDate;
        }

        // Track listening streak of plays within 15 minutes
        if (listeningStreakBuffer.lastTrackDate) {
            const timeDiffMinutes = (listeningStreakBuffer.lastTrackDate - trackDate) / (1000 * 60); // Convert to minutes
            
            if (timeDiffMinutes <= 15) {
                // Continue the streak
                listeningStreakBuffer.count++;
                listeningStreakBuffer.endDate = trackDate;
            } else {
                // Save completed streak
                if (listeningStreakBuffer.count >= 5) {
                    const durationSeconds = (listeningStreakBuffer.startDate - listeningStreakBuffer.endDate) / 1000;
                    allListeningStreaks.push({
                        username: username,
                        count: listeningStreakBuffer.count,
                        duration: Math.round(durationSeconds),
                        startDate: listeningStreakBuffer.endDate,
                        endDate: listeningStreakBuffer.startDate
                    });
                }
                // Start new streak
                listeningStreakBuffer.count = 1;
                listeningStreakBuffer.startDate = trackDate;
                listeningStreakBuffer.endDate = trackDate;
            }
        } else {
            // First track
            listeningStreakBuffer.count = 1;
            listeningStreakBuffer.startDate = trackDate;
            listeningStreakBuffer.endDate = trackDate;
        }
        listeningStreakBuffer.lastTrackDate = trackDate;
    });
    
    // Save any remaining streaks
    if (artistStreakBuffer.count >= 2 && artistStreakBuffer.current) {
        allArtistStreaks.push({
            username: username,
            count: artistStreakBuffer.count,
            name: artistStreakBuffer.current,
            startDate: artistStreakBuffer.endDate,
            endDate: artistStreakBuffer.startDate
        });
    }
    if (albumStreakBuffer.count >= 2 && albumStreakBuffer.current) {
        const [albumName, artistName] = albumStreakBuffer.current.split('::');
        allAlbumStreaks.push({
            username: username,
            count: albumStreakBuffer.count,
            name: albumName,
            artist: artistName,
            image: albumStreakBuffer.image,
            startDate: albumStreakBuffer.endDate,
            endDate: albumStreakBuffer.startDate
        });
    }
    if (trackStreakBuffer.count >= 2 && trackStreakBuffer.current) {
        const [trackName, artistName] = trackStreakBuffer.current.split('::');
        allTrackStreaks.push({
            username: username,
            count: trackStreakBuffer.count,
            name: trackName,
            artist: artistName,
            startDate: trackStreakBuffer.endDate,
            endDate: trackStreakBuffer.startDate
        });
    }
    if (listeningStreakBuffer.count >= 5) {
        const durationSeconds = (listeningStreakBuffer.startDate - listeningStreakBuffer.endDate) / 1000;
        allListeningStreaks.push({
            username: username,
            count: listeningStreakBuffer.count,
            duration: Math.round(durationSeconds),
            startDate: listeningStreakBuffer.endDate,
            endDate: listeningStreakBuffer.startDate
        });
    }

    chartDataPerUser[username] = {
        artistPlays: userArtists,
        albumPlays: userAlbums,
        trackPlays: userTracks,
        streaks: {
            artists: allArtistStreaks,
            albums: allAlbumStreaks,
            tracks: allTrackStreaks,
            listening: allListeningStreaks
        }
    };
    return chartDataPerUser[username];
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
            pageState['artist-streaks'].totalItems = sortedData['artist-streaks']?.length || 0;
            pageState['album-streaks'].totalItems = sortedData['album-streaks']?.length || 0;
            pageState['track-streaks'].totalItems = sortedData['track-streaks']?.length || 0;
            pageState['listening-streaks'].totalItems = sortedData['listening-streaks']?.length || 0;
            
            // Reset to page 1
            pageState.artists.currentPage = 1;
            pageState.albums.currentPage = 1;
            pageState.tracks.currentPage = 1;
            pageState.listeners.currentPage = 1;
            pageState['unique-artists'].currentPage = 1;
            pageState['unique-tracks'].currentPage = 1;
            pageState['artist-streaks'].currentPage = 1;
            pageState['album-streaks'].currentPage = 1;
            pageState['track-streaks'].currentPage = 1;
            pageState['listening-streaks'].currentPage = 1;
            
            // Display first page of each list
            await displayPage('artists');
            await displayPage('albums');
            await displayPage('tracks');
            await displayPage('listeners');
            await displayPage('unique-artists');
            await displayPage('unique-tracks');
            await displayPage('artist-streaks');
            await displayPage('album-streaks');
            await displayPage('track-streaks');
            await displayPage('listening-streaks');
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
    
    // Sort streaks
    const artistStreaks = [];
    const albumStreaks = [];
    const trackStreaks = [];
    const listeningStreaks = [];
    
    Object.entries(chartDataPerUser).forEach(([username, userData]) => {
        artistStreaks.push(...userData.streaks.artists);
        albumStreaks.push(...userData.streaks.albums);
        trackStreaks.push(...userData.streaks.tracks);
        listeningStreaks.push(...userData.streaks.listening);
    });
    
    sortedData['artist-streaks'] = artistStreaks
        .sort((a, b) => b.count - a.count);
    
    sortedData['album-streaks'] = albumStreaks
        .sort((a, b) => b.count - a.count);
    
    sortedData['track-streaks'] = trackStreaks
        .sort((a, b) => b.count - a.count);
    
    sortedData['listening-streaks'] = listeningStreaks
        .sort((a, b) => b.duration - a.duration);

    // Wait for chart audio to finish playing
    while (audioState.currentChartAudio) {
        await new Promise(r => setTimeout(r, 100));
    }

    pageState.artists.totalItems = sortedData.artists.length;
    pageState.albums.totalItems = sortedData.albums.length;
    pageState.tracks.totalItems = sortedData.tracks.length;
    pageState.listeners.totalItems = sortedData.listeners.length;
    pageState['unique-artists'].totalItems = sortedData['unique-artists'].length;
    pageState['unique-tracks'].totalItems = sortedData['unique-tracks'].length;
    pageState['artist-streaks'].totalItems = sortedData['artist-streaks'].length;
    pageState['album-streaks'].totalItems = sortedData['album-streaks'].length;
    pageState['track-streaks'].totalItems = sortedData['track-streaks'].length;
    pageState['listening-streaks'].totalItems = sortedData['listening-streaks'].length;

    await displayPage('artists');
    await displayPage('albums');
    await displayPage('tracks');
    await displayPage('listeners');
    await displayPage('unique-artists');
    await displayPage('unique-tracks');
    await displayPage('artist-streaks');
    await displayPage('album-streaks');
    await displayPage('track-streaks');
    await displayPage('listening-streaks');

    cacheListening(userListeningTime, userPlayCounts);
    cachePlays(trackPlays);
    cacheSortedData(sortedData);

    trackData = trackPlays;
}