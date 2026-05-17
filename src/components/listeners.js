// State
import { store } from "../state/store.js";

// API
import * as lastfm from "../api/lastfm.js";
import { getJSONP } from "../api/deezer.js";

// Charts
import { chartDataPerUser, sortedData, allUsersDailyTotals } from "./charts/update.js";

// Charts - Lists
import { imageCache } from "./charts/lists/lists.js";

// Cache for tag data from Last.fm responses
const tagCache = new Map();

// Constants for mini bar chart
const MAX_HEIGHT_PX = 20;
const FLOOR_PX = 3;

// Helper function to format time
function formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = Math.floor((now - (timestamp * 1000)) / 1000);

    if (diff < 60) {
        return "just now";
    } else if (diff < 60 * 60) {
        const minutes = Math.floor(diff / 60);
        return `${minutes}m ago`;
    } else if (diff < 60 * 60 * 24) {
        const hours = Math.floor(diff / (60 * 60));
        return `${hours}h ago`;
    } else if (diff < 60 * 60 * 24 * 7) {
        const days = Math.floor(diff / (60 * 60 * 24));
        return `${days}d ago`;
    }
    return null;
}

function formatCount(n) {
    if (n >= 1000) {
        return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
    }
    return n.toLocaleString();
}

// Build the expand body HTML for a listener item
function buildListenerExpandBody(username, itemKey, itemType, globalMaxDayCount) {
    const userData = chartDataPerUser[username];
    const itemData = itemType === 'track'
        ? userData?.trackPlays?.[itemKey]
        : userData?.artistPlays?.[itemKey];

    // If this user has no weekly data for the artist/track, ignore
    if (!itemData?.plays) return '';

    const weekPlays = itemData.plays;

    // Sort user's own plays for this artist/track
    const playsMap = itemType === 'track' ? userData?.trackPlays : userData?.artistPlays;
    let personalRank = '-';
    if (playsMap) {
        const sorted = Object.entries(playsMap).sort((a, b) => (b[1].plays || 0) - (a[1].plays || 0));
        const idx = sorted.findIndex(([key]) => key === itemKey);
        if (idx >= 0) personalRank = formatCount(idx + 1);
    }

    // Mini bar chart
    const dayCounts = itemData?.dailyData?.map(d => d.count) ?? new Array(8).fill(0);
    const userMaxDayCount = Math.max(...dayCounts, 0);
    const todayDate = new Date();
    const sparkBars = dayCounts.map((val, i) => {
        const isToday = i === 7;
        // x^0.5 scaling to reduce effect of outlier users
        const heightPx = val === 0 ? 0 : Math.round(FLOOR_PX + (Math.pow(val, 0.5) / Math.pow(globalMaxDayCount, 0.5)) * (MAX_HEIGHT_PX - FLOOR_PX));
        const isPeak = val === userMaxDayCount && val > 0 && heightPx >= MAX_HEIGHT_PX * 0.4;
        const d = new Date(todayDate);
        d.setDate(todayDate.getDate() - (7 - i));
        const fillCls = `day-fill${isPeak ? ' peak' : ''}${isToday ? ' today' : ''}`;
        const labelCls = `day-label${isToday ? ' today' : ''}`;
        const dayChar = ['S','M','T','W','T','F','S'][d.getDay()];
        return `<div class="day-col"><div class="${fillCls}" style="height:${heightPx}px"></div><div class="${labelCls}">${dayChar}</div></div>`;
    }).join('');

    const rankStat = personalRank
        ? `<div class="expand-stat is-rank"><div class="expand-stat-val">#${personalRank}</div><div class="expand-stat-key">weekly rank</div></div>`
        : '';

    return `
        <div class="listener-expand-body">
            ${rankStat}
            <div class="expand-stat"><div class="expand-stat-val">${weekPlays}</div><div class="expand-stat-key">this week</div></div>
            <div class="split-graph expand-spark">${sparkBars}</div>
        </div>`;
}

// Build the left stats panel HTML for the listeners screen
function buildListenerStatsPanel(listeners, itemKey, itemType, genreNames) {
    // Rank lookup
    const rankedList = itemType === 'track' ? sortedData.tracks : sortedData.artists;
    const rankIndex = rankedList.findIndex(([key]) => key === itemKey);
    const rank = rankIndex >= 0 ? rankIndex + 1 : null;

    // Sum raw play counts across listeners
    let weekPlays = 0;
    let weekListeners = 0;
    listeners.forEach(listener => {
        const userData = chartDataPerUser[listener.username];
        const itemData = itemType === 'track'
            ? userData?.trackPlays?.[itemKey]
            : userData?.artistPlays?.[itemKey];
        const plays = itemData?.plays || 0;
        weekPlays += plays;
        if (plays > 0) weekListeners++;
    });

    // For each day, sum up total plays from all users for this artist/track
    const playsByDate = new Map();
    listeners.forEach(listener => {
        const userData = chartDataPerUser[listener.username];
        const itemData = itemType === 'track'
            ? userData?.trackPlays?.[itemKey]
            : userData?.artistPlays?.[itemKey];
        itemData?.dailyData?.forEach(({ key, count }) => {
            playsByDate.set(key, (playsByDate.get(key) || 0) + count);
        });
    });

    // Sum all-time plays across listeners
    const allTimePlays = listeners.reduce((sum, l) => sum + l.playCount, 0);

    // Count users listening now
    const nowCount = listeners.filter(l => {
        const recent = chartDataPerUser[l.username]?.recentTracks?.[0];
        if (!recent?.["@attr"]?.nowplaying) return false;
        if (itemType === 'track') {
            const sep = itemKey.indexOf('::');
            const trackName = itemKey.slice(0, sep);
            const artistName = itemKey.slice(sep + 2);
            return recent.name.trim() === trackName && recent.artist.name === artistName;
        }
        return recent.artist.name === itemKey;
    }).length;

    // Calculate ratio of this artist/track's plays to all plays that day
    const recentKeys = Object.keys(allUsersDailyTotals).sort();
    const dayRatios = recentKeys.map(key => {
        const plays = playsByDate.get(key) || 0;
        const total = allUsersDailyTotals[key] || 0;
        return total > 0 ? plays / total : 0;
    });

    // Graph bars for the last 8 days
    const maxRatio = Math.max(...dayRatios);
    const todayDate = new Date();
    const graphCols = dayRatios.map((val, i) => {
        const isToday = i === 7;
        const isPeak = val === maxRatio && val > 0;
        const heightPx = (val === 0 || maxRatio === 0) ? 0 : Math.max(FLOOR_PX, Math.round((val / maxRatio) * MAX_HEIGHT_PX));
        const d = new Date(todayDate);
        d.setDate(todayDate.getDate() - (7 - i));
        const fillCls = `day-fill${isPeak ? ' peak' : ''}${isToday ? ' today' : ''}`;
        const labelCls = `day-label${isToday ? ' today' : ''}`;
        const dayChar = ['S','M','T','W','T','F','S'][d.getDay()];
        return `<div class="day-col"><div class="${fillCls}" style="height:${heightPx}px"></div><div class="${labelCls}">${dayChar}</div></div>`;
    }).join('');

    // List tags
    const tagsHtml = genreNames?.length
        ? `<div class="split-genres"><div class="split-stat-key">genres</div>${genreNames.slice(0, 3).map(g => `<span>${g}</span>`).join('')}</div>`
        : '';

    // Show live listener indicator if at least 2 are listening now
    const liveHtml = nowCount >= 2
        ? `<div class="split-stat split-stat-live"><div class="split-stat-val"><span class="split-live-dot"></span>${nowCount}</div><div class="split-stat-key">listening now</div></div>`
        : '';

    return `
        <div class="split-left">
            <div class="split-rank"><div class="split-rank-num">${rank ? `#${formatCount(rank)}` : '-'}</div><div class="split-rank-label">${itemType} this week</div></div>
            <div class="split-stat"><div class="split-stat-val">${weekPlays > 0 ? formatCount(weekPlays) : '-'}<span class="split-week-sep">/</span><span class="split-week-listeners">${weekListeners}</span></div><div class="split-stat-key">plays<span class="split-week-sep">/</span>${weekListeners === 1 ? 'listener' : 'listeners'}</div></div>
            <div class="split-stat split-stat-alltime"><div class="split-stat-val">${formatCount(allTimePlays)}</div><div class="split-stat-key">all time</div></div>
            ${liveHtml}
            ${tagsHtml}
            <div class="split-graph">${graphCols}</div>
        </div>`;
}

// Fetch track listeners
export async function fetchTrackListeners(block, key = store.keys.KEY3) {
    const username = block.dataset.username;

    // Reselect block in case it changed during fetch
    block = document.querySelector(`.block[data-username="${username}"]`);
    
    let listenersContent = block.querySelector(".listeners-content-track");
    let YOffset = 0;

    // Set listeners loaded value to intermediate "1" (loading in progress) if initial load
    if (block.dataset.trackListenersLoaded != "2") {
        block.dataset.trackListenersLoaded = "1";

        // Show loading message
        listenersContent.innerHTML = `
            <div class="listeners-loading">
                    <div>Loading listeners...</div>
                </div>
            `;
    } else {
        YOffset = block.querySelector(".listeners-content-track .listeners-list").scrollTop;
    }

    store.isFetchingListeners = true;

    const artistName = block.querySelector(".artist-title > a").innerText;
    const trackName = block.querySelector(".song-title > a").innerText;

    const cacheKey = `track:${trackName}::${artistName}`;

    let genreNames = tagCache.get(cacheKey) || [];
    let albumName = null;

    let trackTab = block.querySelector('.listeners-tab[data-tab="track"]');

    let rateLimited = false;

    try {
        const allBlocks = Array.from(document.querySelectorAll(".block"));

        // Map blocks to a track fetch
        const listenerPromises = allBlocks.map(async (friendBlock) => {
            const friendUsername = friendBlock.dataset.username;

            try {
                // If we've been rate limited already, return
                if (rateLimited) return null;

                const friendData = await lastfm.getTrackInfo(friendUsername, key, artistName, trackName);

                // Extract track tags and album name if we don't have them yet
                if (friendData?.track) {
                    if (!albumName && friendData.track.album?.title) {
                        albumName = friendData.track.album.title;
                    }
                    if (genreNames.length === 0 && friendData.track.toptags?.tag) {
                        const tagsData = friendData.track.toptags.tag;
                        genreNames = tagsData.slice(0, 3).map(t => t.name);
                        tagCache.set(cacheKey, genreNames);
                    }
                }

                if (
                    !friendData.error &&
                    parseInt(friendData?.track.userplaycount)
                ) {
                    const playCount = parseInt(friendData?.track.userplaycount);
                    const loved = friendData?.track.userloved === "1";
                    const friendImageUrl =
                        friendBlock.querySelector("#pfp")?.src ||
                        'https://lastfm.freetls.fastly.net/i/u/avatar170s/818148bf682d429dc215c1705eb27b98.png';

                    // Get last listen time for track
                    const trackKey = `${trackName.trim()}::${artistName}`;
                    const lastListenTime = formatTimeAgo(chartDataPerUser[friendUsername]?.trackPlays?.[trackKey]?.lastListen);
                    const weekPlays = chartDataPerUser[friendUsername]?.trackPlays?.[trackKey]?.plays || 0;

                    return {
                        username: friendUsername,
                        playCount,
                        weekPlays,
                        loved,
                        imageUrl: friendImageUrl,
                        userUrl: `https://www.last.fm/user/${friendUsername}`,
                        trackUrl: `https://www.last.fm/user/${friendUsername}/library/music/${encodeURIComponent(artistName)}/_/${encodeURIComponent(trackName)}`,
                        lastListen: lastListenTime
                    };
                }
            } catch (e) {
                // If we've been rate limited, show message
                if (e.code === 29) {
                    rateLimited = true;
                    listenersContent = document.querySelector(`.block[data-username="${username}"] .listeners-content-track`);
                    listenersContent.innerHTML = `
                      <div class="no-listeners">
                        <div>You're making requests too quickly. Please try again in a moment.</div>
                      </div>`;
                    store.isFetchingListeners = false;
                    gtag('event', 'rate_limit-listeners', {});
                    return null;
                } else if (e.code == 6) {
                    return null;
                } else {
                    console.error(`Error checking listener ${friendUsername}:`, e);
                    throw e;
                }
            }
            return null;
        });

        const results = await Promise.all(listenerPromises);

        // If rate limited, skip rest of function
        if (rateLimited) {
            return;
        }

        // Fall back to album tags, then artist tags if track has none
        if (genreNames.length === 0 && albumName) {
            const albumCacheKey = `album:${albumName}::${artistName}`;
            let albumGenres = tagCache.get(albumCacheKey);
            if (!albumGenres) {
                try {
                    const albumData = await lastfm.getAlbumInfo(key, artistName, albumName);
                    if (albumData?.album?.tags?.tag) {
                        const tagsData = albumData.album.tags.tag;
                        albumGenres = tagsData.slice(0, 3).map(t => t.name);
                        tagCache.set(albumCacheKey, albumGenres);
                    }
                } catch (e) {
                    // continue to artist fallback
                }
            }
            if (albumGenres?.length) genreNames = albumGenres;
        }
        if (genreNames.length === 0) {
            genreNames = tagCache.get(`artist:${artistName}`) || [];
        }

        // Get only users who played track
        const listeners = results.filter(item => item !== null);
        listeners.sort((a, b) => b.playCount - a.playCount);

        // Add users currently playing this track for the first time (not yet in listener list)
        const listenerUsernames = new Set(listeners.map(l => l.username));
        for (const friendBlock of document.querySelectorAll('.block')) {
            const friendUsername = friendBlock.dataset.username;
            if (listenerUsernames.has(friendUsername)) continue;
            const nowPlaying = chartDataPerUser[friendUsername]?.recentTracks?.[0];
            if (nowPlaying?.["@attr"]?.nowplaying &&
                nowPlaying.name.trim() === trackName.trim() &&
                nowPlaying.artist.name === artistName) {
                listeners.push({
                    username: friendUsername,
                    playCount: 0,
                    weekPlays: 0,
                    loved: false,
                    imageUrl: friendBlock.querySelector('#pfp')?.src || 'https://lastfm.freetls.fastly.net/i/u/avatar170s/818148bf682d429dc215c1705eb27b98.png',
                    userUrl: `https://www.last.fm/user/${friendUsername}`,
                    trackUrl: `https://www.last.fm/user/${friendUsername}/library/music/${encodeURIComponent(artistName)}/_/${encodeURIComponent(trackName)}`,
                    lastListen: null,
                    isNew: true
                });
            }
        }

        // Reselect block in case it changed during fetch
        block = document.querySelector(`.block[data-username="${username}"]`);
        
        // Check if track tab is still active before appending to DOM
        trackTab = block.querySelector('.listeners-tab[data-tab="track"]');
        if (!trackTab.classList.contains('active')) {
            store.isFetchingListeners = false;
            return;
        }
        
        listenersContent = block.querySelector(`.listeners-content-track`);

        // Save expanded state before re-render
        const expandedUsers = new Set(
            [...listenersContent.querySelectorAll('.listener-item-expandable.expanded')]
                .map(r => r.dataset.username)
        );

        // Append to container
        if (listeners.length > 0) {
            const trackKey = `${trackName.trim()}::${artistName}`;
            const trackGlobalMaxDayCount = Math.max(...listeners.flatMap(l => (chartDataPerUser[l.username]?.trackPlays?.[trackKey]?.dailyData || []).map(d => d.count)), 1);
            const maxPlaysTrack = Math.max(listeners[0].playCount, 1);
            listenersContent.innerHTML = `
                <div class="listeners-split">
                    ${buildListenerStatsPanel(listeners, trackKey, 'track', genreNames)}
                    <div class="listeners-right-col">
                        <div class="listeners-list">
                            ${listeners.map(listener => {
                                const expandBody = buildListenerExpandBody(listener.username, trackKey, 'track', trackGlobalMaxDayCount);
                                const barWidth = listener.playCount === 0 ? 0 : 5 + Math.round((listener.playCount / maxPlaysTrack) * 95);
                                const isNew = listener.isNew || (listener.weekPlays > 0 && listener.playCount === listener.weekPlays);
                                const userTrackPlaysMap = chartDataPerUser[listener.username]?.trackPlays;
                                const isTop = listener.weekPlays > 0 && userTrackPlaysMap &&
                                    Object.entries(userTrackPlaysMap).sort((a, b) => (b[1].plays || 0) - (a[1].plays || 0)).findIndex(([key]) => key === trackKey) === 0;
                                const isSelf = listener.username === username;
                                return `
                                <div class="listener-item${expandBody ? ' listener-item-expandable' : ''}${isNew ? ' new-listener' : ''}${isTop ? ' top-item' : ''}${isSelf ? ' listener-item-self' : ''}" data-username="${listener.username}"${expandBody ? ` data-library-url="${listener.trackUrl}"` : ''} style="--lbar:${barWidth}%">
                                    <div class="listener-chevron"${!expandBody ? ' style="visibility:hidden"' : ''}><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></div>
                                    <img class="listener-pfp" src="${listener.imageUrl}">
                                    <div class="listener-info">
                                        <div class="linfo">
                                            <div class="listener-username-name">
                                                ${expandBody ? `<span class="listener-username-text">${listener.username}</span>` : `<a class="listener-username-text" href="${listener.trackUrl}" target="_blank">${listener.username}</a>`}
                                                ${listener.loved ? '<svg class="listener-heart" viewBox="0 0 120 120" fill="white"><path class="st0" d="M60.83,17.19C68.84,8.84,74.45,1.62,86.79,0.21c23.17-2.66,44.48,21.06,32.78,44.41 c-3.33,6.65-10.11,14.56-17.61,22.32c-8.23,8.52-17.34,16.87-23.72,23.2l-17.4,17.26L46.46,93.56C29.16,76.9,0.95,55.93,0.02,29.95 C-0.63,11.75,13.73,0.09,30.25,0.3C45.01,0.5,51.22,7.84,60.83,17.19L60.83,17.19L60.83,17.19z"/></svg>' : ""}
                                            </div>
                                            ${listener.lastListen || isNew || isTop ? `<div class="listener-last-listen">${listener.lastListen ? listener.lastListen : ''}${isNew ? ' <span class="new-badge">new</span>' : ''}${isTop ? ' <span class="top-badge">#1</span>' : ''}</div>` : ''}
                                        </div>
                                        <div class="listener-playcount-col">
                                            <div class="listener-playcount-alltime">${listener.playCount.toLocaleString()}</div>
                                            ${listener.weekPlays > 0 ? `<div class="listener-week-plays">${formatCount(listener.weekPlays)}</div>` : ''}
                                        </div>
                                    </div>
                                    ${expandBody}
                                </div>`;
                            }).join('')}
                        </div>
                    </div>
                </div>
            `;

            // Restore scroll position
            block.querySelector('.listeners-content-track .listeners-list').scrollTop = YOffset;

            // Restore expanded state
            expandedUsers.forEach(u => {
                const row = listenersContent.querySelector(`.listener-item-expandable[data-username="${u}"]`);
                if (row) row.classList.add('expanded');
            });

            // Add scroll listener to container to pause sortBlocks() when scrolling
            const list = block.querySelector('.listeners-list');
            list.addEventListener('scroll', () => {
                store.isScrolling = true;
                clearTimeout(store.scrollTimeoutId);
                store.scrollTimeoutId = setTimeout(() => { store.isScrolling = false; }, 2000);
            }, { passive: true });
            if ('onscrollend' in window) {
                list.addEventListener('scrollend', () => {
                    clearTimeout(store.scrollTimeoutId);
                    store.isScrolling = false;
                }, { passive: true });
            }

        } else {
            listenersContent.innerHTML = `
                <div class="no-listeners">
                    <div>None of your friends have played this track yet.</div>
                </div>
            `;
        }

        // Set listeners loaded dataset value to "2" (loading complete)
        block.dataset.trackListenersLoaded = "2";
    } catch (error) {
        console.error("Error fetching track listeners:", error);

        block = document.querySelector(`.block[data-username="${username}"]`);
        listenersContent = block.querySelector(".listeners-content-track");
        listenersContent.innerHTML = `
       <div class="no-listeners">
         <div>Couldn't load listener data. Try again.</div>
       </div>`;
        block.dataset.trackListenersLoaded = "0";
    } finally {
        store.isFetchingListeners = false;
    }
}

// Fetch artist listeners
export async function fetchArtistListeners(block, key = store.keys.KEY3) {
    const username = block.dataset.username;

    // Reselect block in case it changed during fetch
    block = document.querySelector(`.block[data-username="${username}"]`);

    let listenersContent = block.querySelector(".listeners-content-artist");
    let YOffset = 0;

    // Set listeners loaded value to intermediate "1" (loading in progress) if initial load
    if (block.dataset.artistListenersLoaded != "2") {
        block.dataset.artistListenersLoaded = "1";

        // Show loading message
        listenersContent.innerHTML = `
            <div class="listeners-loading">
                <div>Loading listeners...</div>
            </div>
        `;
    } else {
        YOffset = block.querySelector(".listeners-content-artist .listeners-list").scrollTop;
    }

    const artistName = block.querySelector(".artist-title > a").innerText;
    const trackName = block.querySelector(".song-title > a").innerText;

    const albumImageUrl = block.style.backgroundImage.slice(5, -2);

    const cacheKey = `artist:${artistName}`;
    
    let artistImageUrl;
    let genreNames = tagCache.get(cacheKey) || [];

    // Check image cache first
    if (imageCache.has(cacheKey)) {
        artistImageUrl = imageCache.get(cacheKey);
    } else {
        try {
            const fetchUrl = `https://api.deezer.com/search/artist?q="${encodeURIComponent(artistName)}"&output=jsonp`;
            const response = await getJSONP(fetchUrl, 5000);
            const artistWords = artistName.toLowerCase().split(/\s+/);
            const match = response.data.find(a => artistWords.some(w => a.name.toLowerCase().includes(w)));
            artistImageUrl = match?.picture_medium || 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.jpg';
        } catch (error) {
            artistImageUrl = 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.jpg';
            console.error(`Error fetching artist image for ${artistName}:`, error);
        }
        
        imageCache.set(cacheKey, artistImageUrl);
    }

    store.isFetchingListeners = true;

    // Reselect block in case it changed during fetch
    block = document.querySelector(`.block[data-username="${username}"]`);

    let trackTab = block.querySelector('.listeners-tab[data-tab="track"]');
    let artistTab = block.querySelector('.listeners-tab[data-tab="artist"]');
    const albumImageEl = trackTab.querySelector('.album-image');
    const artistTabArtistImg = artistTab.querySelector('.artist-image');
    const trackTabText = trackTab.querySelector('span');
    const artistTabText = artistTab.querySelector('span');
    
    albumImageEl.src = albumImageUrl;
    albumImageEl.style.display = 'block';
    artistTabArtistImg.src = artistImageUrl;
    artistTabArtistImg.style.display = 'block';
    trackTabText.textContent = trackName;
    artistTabText.textContent = artistName;
    
    let rateLimited = false;

    try {
        const allBlocks = Array.from(document.querySelectorAll(".block"));

        // Map blocks to an artist fetch
        const listenerPromises = allBlocks.map(async (friendBlock) => {
            const friendUsername = friendBlock.dataset.username;

            try {
                // If we've been rate limited already, return
                if (rateLimited) return null;

                const friendData = await lastfm.getArtistInfo(friendUsername, key, artistName);

                // Extract artist tags if we don't have them yet
                if (genreNames.length === 0 && friendData && friendData.artist && friendData.artist.tags && friendData.artist.tags.tag) {
                    const tagsData = friendData.artist.tags.tag;
                    genreNames = tagsData.slice(0, 3).map(t => t.name);
                    tagCache.set(cacheKey, genreNames);
                }

                if (
                    !friendData.error &&
                    parseInt(friendData?.artist.stats.userplaycount)
                ) {
                    const playCount = parseInt(friendData.artist.stats.userplaycount);
                    const friendImageUrl =
                        friendBlock.querySelector("#pfp")?.src ||
                        'https://lastfm.freetls.fastly.net/i/u/avatar170s/818148bf682d429dc215c1705eb27b98.png';

                    // Get last listen time for artist
                    const lastListenTime = formatTimeAgo(chartDataPerUser[friendUsername]?.artistPlays?.[artistName]?.lastListen);
                    const weekPlays = chartDataPerUser[friendUsername]?.artistPlays?.[artistName]?.plays || 0;

                    return {
                        username: friendUsername,
                        playCount,
                        weekPlays,
                        imageUrl: friendImageUrl,
                        userUrl: `https://www.last.fm/user/${friendUsername}`,
                        artistUrl: `https://www.last.fm/user/${friendUsername}/library/music/${encodeURIComponent(artistName)}`,
                        lastListen: lastListenTime
                    };
                }
            } catch (e) {
                // If we've been rate limited, show message
                if (e.code === 29) {
                    rateLimited = true;
                    listenersContent = document.querySelector(`.block[data-username="${username}"] .listeners-content-artist`);
                    listenersContent.innerHTML = `
                      <div class="no-listeners">
                        <div>You're making requests too quickly. Please try again in a moment.</div>
                      </div>`;
                    store.isFetchingListeners = false;
                    gtag('event', 'rate_limit-listeners', {});
                    return null;
                } else if (e.code == 6) {
                    return null;
                } else {
                    console.error(`Error checking listener ${friendUsername}:`, e);
                    throw e;
                }
            }
            return null;
        });

        const results = await Promise.all(listenerPromises);

        // If rate limited, skip rest of function
        if (rateLimited) {
            return;
        }

        // Get only users who played artist
        const listeners = results.filter(item => item !== null);
        listeners.sort((a, b) => b.playCount - a.playCount);

        // Add users currently playing this artist for the first time (not yet in listener list)
        const listenerUsernames = new Set(listeners.map(l => l.username));
        for (const friendBlock of document.querySelectorAll('.block')) {
            const friendUsername = friendBlock.dataset.username;
            if (listenerUsernames.has(friendUsername)) continue;
            const nowPlaying = chartDataPerUser[friendUsername]?.recentTracks?.[0];
            if (nowPlaying?.["@attr"]?.nowplaying && nowPlaying.artist.name === artistName) {
                listeners.push({
                    username: friendUsername,
                    playCount: 0,
                    weekPlays: 0,
                    imageUrl: friendBlock.querySelector('#pfp')?.src || 'https://lastfm.freetls.fastly.net/i/u/avatar170s/818148bf682d429dc215c1705eb27b98.png',
                    userUrl: `https://www.last.fm/user/${friendUsername}`,
                    artistUrl: `https://www.last.fm/user/${friendUsername}/library/music/${encodeURIComponent(artistName)}`,
                    lastListen: null,
                    isNew: true
                });
            }
        }

        // Reselect block in case it changed during fetch
        block = document.querySelector(`.block[data-username="${username}"]`);
        
        // Check if artist tab is still active before appending to DOM
        const artistTab = block.querySelector('.listeners-tab[data-tab="artist"]');
        if (!artistTab.classList.contains('active')) {
            store.isFetchingListeners = false;
            return;
        }
        
        listenersContent = block.querySelector(`.listeners-content-artist`);

        // Save expanded state before re-render
        const expandedUsers = new Set(
            [...listenersContent.querySelectorAll('.listener-item-expandable.expanded')]
                .map(r => r.dataset.username)
        );

        // Append to container
        if (listeners.length > 0) {
            const artistGlobalMaxDayCount = Math.max(...listeners.flatMap(l => (chartDataPerUser[l.username]?.artistPlays?.[artistName]?.dailyData || []).map(d => d.count)), 1);
            const maxPlaysArtist = Math.max(listeners[0].playCount, 1);
            listenersContent.innerHTML = `
                <div class="listeners-split">
                    ${buildListenerStatsPanel(listeners, artistName, 'artist', genreNames)}
                    <div class="listeners-right-col">
                        <div class="listeners-list">
                            ${listeners.map(listener => {
                                const expandBody = buildListenerExpandBody(listener.username, artistName, 'artist', artistGlobalMaxDayCount);
                                const barWidth = listener.playCount === 0 ? 0 : 3 + Math.round((listener.playCount / maxPlaysArtist) * 97);
                                const isNew = listener.isNew || (listener.weekPlays > 0 && listener.playCount === listener.weekPlays);
                                const userArtistPlaysMap = chartDataPerUser[listener.username]?.artistPlays;
                                const isTop = listener.weekPlays > 0 && userArtistPlaysMap &&
                                    Object.entries(userArtistPlaysMap).sort((a, b) => (b[1].plays || 0) - (a[1].plays || 0)).findIndex(([key]) => key === artistName) === 0;
                                const isSelf = listener.username === username;
                                return `
                                <div class="listener-item${expandBody ? ' listener-item-expandable' : ''}${isNew ? ' new-listener' : ''}${isTop ? ' top-item' : ''}${isSelf ? ' listener-item-self' : ''}" data-username="${listener.username}"${expandBody ? ` data-library-url="${listener.artistUrl}"` : ''} style="--lbar:${barWidth}%">
                                    <div class="listener-chevron"${!expandBody ? ' style="visibility:hidden"' : ''}><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></div>
                                    <img class="listener-pfp" src="${listener.imageUrl}">
                                    <div class="listener-info">
                                        <div class="linfo">
                                            <div class="listener-username-name">
                                                ${expandBody ? `<span class="listener-username-text">${listener.username}</span>` : `<a class="listener-username-text" href="${listener.artistUrl}" target="_blank">${listener.username}</a>`}
                                            </div>
                                            ${listener.lastListen || isNew || isTop ? `<div class="listener-last-listen">${listener.lastListen ? listener.lastListen : ''}${isNew ? ' <span class="new-badge">new</span>' : ''}${isTop ? ' <span class="top-badge">#1</span>' : ''}</div>` : ''}
                                        </div>
                                        <div class="listener-playcount-col">
                                            <div class="listener-playcount-alltime">${listener.playCount.toLocaleString()}</div>
                                            ${listener.weekPlays > 0 ? `<div class="listener-week-plays">${formatCount(listener.weekPlays)}</div>` : ''}
                                        </div>
                                    </div>
                                    ${expandBody}
                                </div>`;
                            }).join('')}
                        </div>
                    </div>
                </div>
            `;

            // Restore scroll position
            block.querySelector('.listeners-content-artist .listeners-list').scrollTop = YOffset;

            // Restore expanded state
            expandedUsers.forEach(u => {
                const row = listenersContent.querySelector(`.listener-item-expandable[data-username="${u}"]`);
                if (row) row.classList.add('expanded');
            });

            // Add scroll listener to container to pause sortBlocks() when scrolling
            const list = block.querySelector('.listeners-content-artist .listeners-list');
            list.addEventListener('scroll', () => {
                store.isScrolling = true;
                clearTimeout(store.scrollTimeoutId);
                store.scrollTimeoutId = setTimeout(() => { store.isScrolling = false; }, 2000);
            }, { passive: true });
            if ('onscrollend' in window) {
                list.addEventListener('scrollend', () => {
                    clearTimeout(store.scrollTimeoutId);
                    store.isScrolling = false;
                }, { passive: true });
            }

        } else {
            listenersContent.innerHTML = `
                <div class="no-listeners">
                    <div>None of your friends have played this artist yet.</div>
                </div>
            `;
        }

        // Set listeners loaded dataset value to "2" (loading complete)
        block.dataset.artistListenersLoaded = "2";
    } catch (error) {
        console.error("Error fetching artist listeners:", error);

        block = document.querySelector(`.block[data-username="${username}"]`);
        listenersContent = block.querySelector(".listeners-content-artist");
        listenersContent.innerHTML = `
       <div class="no-listeners">
         <div>Couldn't load listener data. Try again.</div>
       </div>`;
        block.dataset.artistListenersLoaded = "0";
    } finally {
        // Show now that images and user data are loaded
        block = document.querySelector(`.block[data-username="${username}"]`);
        const listenersHeader = block.querySelector(".listeners-header");
        const artistContent = block.querySelector('.listeners-content-artist');
        const artistTab = block.querySelector('.listeners-tab[data-tab="artist"]');

        listenersHeader.style.display = 'flex';
        
        // Make sure artist tab is still active before displaying content
        if (artistTab.classList.contains('active')) {
            artistContent.style.display = 'flex';
        }
        
        store.isFetchingListeners = false;
    }
}