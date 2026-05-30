// State
import { store } from '../../state/store.js';

// API
import * as lastfm from '../../api/lastfm.js';
import { getAlbumReleaseYears } from '../../api/releaseYear.js';

// Charts - Pages
import { pageState, displayPage } from './pages.js';

// Preview
import { audioState } from '../preview/index.js';

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

// Different from "Activity By Day" in weekly charts - this is total plays per day, starting today, going back the last 8 days
// dateKey -> total plays that day across all users
export let allUsersDailyTotals = {};

// Calculate top artists, albums, and tracks from recent track data
export function calculateChartData(tracks, username) {

    const userArtists = {};
    const userAlbums = {};
    const userTracks = {};

    // Track plays per-day for listener tooltips
    const dailyTotals = new Map(); // dateKey -> { total, dayOfMonth, artists: {}, albums: {}, tracks: {} }

    function toDateKey(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
            d.getDate()
        ).padStart(2, "0")}`;
    }
    
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
        const albumMbid = track.album?.mbid;
        const uts = parseInt(track.date.uts);

        // Count artists
        const artistUrl = track.artist.url;
        if (userArtists[artistName]) {
            userArtists[artistName].plays += 1;
        } else {
            userArtists[artistName] = {
                plays: 1,
                artistUrl,
                lastListen: null
            };
        }

        // Track last listen
        if (!Number.isNaN(uts) && uts > userArtists[artistName].lastListen) {
            userArtists[artistName].lastListen = uts;
        }

        // Count albums
        if (albumName) {
            const albumUrl = `${artistUrl}/${encodeURIComponent(albumName).replace(/%20/g, '+')}`;
            const key = `${albumName}::${artistName}`;
            if (userAlbums[key]) {
                userAlbums[key].plays += 1;
                if (!userAlbums[key].mbid && albumMbid) {
                    userAlbums[key].mbid = albumMbid;
                }
                // If we have blank album image currently, try to replace it with valid one
                if (userAlbums[key].img === 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png') {
                    userAlbums[key].img = track.image[1]["#text"];
                }
            } else {
                userAlbums[key] = {
                    artistName,
                    albumName,
                    mbid: albumMbid,
                    plays: 1,
                    artistUrl,
                    albumUrl,
                    img: track.image[1]["#text"],
                    lastListen: null
                };
            }

            // Track last listen
            if (!Number.isNaN(uts) && uts > userAlbums[key].lastListen) {
                userAlbums[key].lastListen = uts;
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
                artistUrl,
                lastListen: null
            };
        }

        // Track last listen
        if (!Number.isNaN(uts) && uts > userTracks[trackKey].lastListen) {
            userTracks[trackKey].lastListen = uts;
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

         // Increment per-day play counts for listener tooltips
        if (!Number.isNaN(uts)) {
            const d = new Date(uts * 1000);
            const key = toDateKey(d);
            if (!dailyTotals.has(key)) {
                dailyTotals.set(key, { total: 0, dayOfMonth: d.getDate(), artists: {}, albums: {}, tracks: {} });
            }
            const entry = dailyTotals.get(key);
            entry.total++;
            entry.artists[artistName] = (entry.artists[artistName] || 0) + 1;
            const albumKeyForDaily = albumName ? `${albumName}::${artistName}` : null;
            if (albumKeyForDaily) {
                entry.albums[albumKeyForDaily] = (entry.albums[albumKeyForDaily] || 0) + 1;
            }
            const trackKeyForDaily = `${trackName}::${artistName}`;
            entry.tracks[trackKeyForDaily] = (entry.tracks[trackKeyForDaily] || 0) + 1;
        }
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

    // Ensure all 8 days are present so graph shows a full week
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    for (let d = new Date(sevenDaysAgo); d <= today; d.setDate(d.getDate() + 1)) {
        const key = toDateKey(d);
        if (!dailyTotals.has(key)) {
            dailyTotals.set(key, { total: 0, dayOfMonth: d.getDate(), artists: {}, albums: {}, tracks: {} });
        }
    }

    const sortedDailyEntries = [...dailyTotals.entries()].sort(([a], [b]) => (a < b ? -1 : 1));

    // Attach dailyData arrays to each artist/album/track
    Object.entries(userArtists).forEach(([artistName, artistData]) => {
        artistData.dailyData = sortedDailyEntries.map(([key, v]) => ({ key, count: v.artists[artistName] || 0 }));
    });

    Object.entries(userAlbums).forEach(([albumKey, albumData]) => {
        albumData.dailyData = sortedDailyEntries.map(([key, v]) => ({ key, count: v.albums[albumKey] || 0 }));
    });

    Object.entries(userTracks).forEach(([trackKey, trackData]) => {
        trackData.dailyData = sortedDailyEntries.map(([key, v]) => ({ key, count: v.tracks[trackKey] || 0 }));
    });

    const userDailyTotals = {};
    sortedDailyEntries.forEach(([key, v]) => { userDailyTotals[key] = v.total; });

    chartDataPerUser[username] = {
        artistPlays: userArtists,
        albumPlays: userAlbums,
        trackPlays: userTracks,
        userDailyTotals,
        streaks: {
            artists: allArtistStreaks,
            albums: allAlbumStreaks,
            tracks: allTrackStreaks,
            listening: allListeningStreaks
        },
        recentTracks: tracks
    };
    return chartDataPerUser[username];
}

// Calculate listening time for users using top tracks API (needed for duration data)
export async function calculateListeningTime() {
    store.isUpdatingListening = true;

    userListeningTime = {};

    const blockContainer = document.getElementById("block-container");
    const blocks = blockContainer.getElementsByClassName("block");
    // Ignore users with no plays this week
    const blocksArr = Array.from(blocks).filter(block => !block.classList.contains("empty"));

    const chunks = [];
    chunks.push(blocksArr.slice(0, 200));

    if (store.friendCount > 200) {
        // Start chunk2 when 180 of chunk1 are done
        let triggerChunk2;
        const chunk2Start = new Promise(r => triggerChunk2 = r);
        let resolvedCount = 0;

        const chunk1Promises = chunks[0].map(block =>
            fetchListeningTime(block).then(result => {
                if (++resolvedCount === 180) triggerChunk2();
                return result;
            })
        );
        Promise.all(chunk1Promises).then(triggerChunk2);

        await chunk2Start;
        chunks.push(blocksArr.slice(200, 400));

        await Promise.all([
            Promise.all(chunk1Promises),
            Promise.all(chunks[1].map(b => fetchListeningTime(b, store.keys.KEY2)))
        ]);
    } else {
        await Promise.all(chunks[0].map(block => fetchListeningTime(block)));
    }

    displayPage("listeners");

    store.updateTimers.listening.lastUpdate = Date.now();
    store.isUpdatingListening = false;
    updateProgressText();
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
export async function updateCharts() {
    let artistPlays = null;
    let albumPlays = null;
    let trackPlays = null;

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
                albumPlays[albumKey].mbid = albumData.mbid;
            } else {
                albumPlays[albumKey] = {
                    artist,
                    albumName,
                    mbid: albumData.mbid,
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
        
    // Add up total plays per day for the last 8 days across all users
    allUsersDailyTotals = {};
    Object.values(chartDataPerUser).forEach(userData => {
        Object.entries(userData.userDailyTotals || {}).forEach(([key, total]) => {
            allUsersDailyTotals[key] = (allUsersDailyTotals[key] || 0) + total;
        });
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

    const nowPlayingAlbums = Array.from(document.querySelectorAll('.block[data-now-playing="true"][data-now-playing-album]'))
        .map(block => ({ artist: block.dataset.nowPlayingArtist, album: block.dataset.nowPlayingAlbum, mbid: block.dataset.nowPlayingMbid || null }));

    const sortedAlbums = [...sortedData.albums]
        .sort((a, b) => b[1].plays - a[1].plays)
        .slice(0, 20000)
        .map(([, data]) => ({ artist: data.artist, album: data.albumName, mbid: data.mbid }));

    getAlbumReleaseYears(sortedAlbums, nowPlayingAlbums).then(() => {
        displayPage('albums');
        displayPage('album-streaks');
    });


    sortedData.tracks = Object.entries(trackPlays).sort((a, b) => {
        const aScore = b[1].userCount * b[1].cappedPlays;
        const bScore = a[1].userCount * a[1].cappedPlays;
        if (aScore !== bScore) {
            return aScore - bScore;
        }
        return pseudoHash(a[0]) - pseudoHash(b[0]);
    });

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

    // Expose new track data now that it's done updating
    trackData = trackPlays;
}