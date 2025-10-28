// State
import { store } from "../state/store.js";

// API
import * as lastfm from "../api/lastfm.js";
import { getJSONP } from "../api/deezer.js";

// Charts
import { chartDataPerUser } from "./charts/update.js";

// Charts - Lists
import { imageCache } from "./charts/lists/lists.js";

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
    const trackName = block.querySelector(".song-title > a").innerText.replace(/<svg.*<\/svg>/g, '').trim();

    const albumImageUrl = block.style.backgroundImage.slice(5, -2);

    let artistImageUrl;
    const cacheKey = `artist:${artistName}`;
    
    // Check image cache first
    if (imageCache.has(cacheKey)) {
        artistImageUrl = imageCache.get(cacheKey);
    } else {
        try {
            const fetchUrl = `https://api.deezer.com/search/artist?q="${artistName}"&output=jsonp`;
            const response = await getJSONP(fetchUrl, 5000);
            artistImageUrl = response.data[0]?.picture_medium || 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.jpg';
            imageCache.set(cacheKey, artistImageUrl);
        } catch (error) {
            artistImageUrl = 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.jpg'
            console.error(`Error fetching artist image for ${artistName}:`, error);
        }
    }

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

        // Map blocks to a track fetch
        const listenerPromises = allBlocks.map(async (friendBlock) => {
            const friendUsername = friendBlock.dataset.username;

            try {
                // If we've been rate limited already, return
                if (rateLimited) return null;

                const friendData = await lastfm.getTrackInfo(friendUsername, key, artistName, trackName);

                if (
                    !friendData.error &&
                    parseInt(friendData?.track.userplaycount)
                ) {
                    const playCount = parseInt(friendData?.track.userplaycount);
                    const loved = friendData?.track.userloved === "1";
                    const friendImageUrl =
                        friendBlock.querySelector("#pfp")?.src ||
                        'https://lastfm.freetls.fastly.net/i/u/avatar170s/818148bf682d429dc215c1705eb27b98.png';

                    // Find last listen time from chart data
                    let lastListenTime = null;
                    if (chartDataPerUser[friendUsername]?.recentTracks) {
                        const tracks = chartDataPerUser[friendUsername].recentTracks;
                        for (let track of tracks) {
                            if (track.name.trim() === trackName && track.artist.name === artistName) {
                                if (track.date?.uts) {
                                    lastListenTime = formatTimeAgo(track.date.uts);
                                    break;
                                }
                            }
                        }
                    }

                    return {
                        username: friendUsername,
                        playCount,
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

        // Get only users who played track
        const listeners = results.filter(item => item !== null);
        listeners.sort((a, b) => b.playCount - a.playCount);

        // Reselect listeners content container in case it changed during fetch
        block = document.querySelector(`.block[data-username="${username}"]`);
        
        // Check if track tab is still active before appending to DOM
        trackTab = block.querySelector('.listeners-tab[data-tab="track"]');
        if (!trackTab.classList.contains('active')) {
            store.isFetchingListeners = false;
            return;
        }
        
        listenersContent = block.querySelector(`.listeners-content-track`);

        // Append to container
        if (listeners.length > 0) {
            listenersContent.innerHTML = `
                <div class="listeners-list">
                    ${listeners.map(listener => `
                        <div class="listener-item">
                            <img class="listener-pfp" src="${listener.imageUrl}">
                            <div class="listener-info">
                                <div class="listener-username">
                                    <div>
                                    <a href="${listener.userUrl}" target="_blank">${listener.username}</a>
                                    ${listener.loved ? '<svg class="listener-heart" viewBox="0 0 120 120" fill="white"><path class="st0" d="M60.83,17.19C68.84,8.84,74.45,1.62,86.79,0.21c23.17-2.66,44.48,21.06,32.78,44.41 c-3.33,6.65-10.11,14.56-17.61,22.32c-8.23,8.52-17.34,16.87-23.72,23.2l-17.4,17.26L46.46,93.56C29.16,76.9,0.95,55.93,0.02,29.95 C-0.63,11.75,13.73,0.09,30.25,0.3C45.01,0.5,51.22,7.84,60.83,17.19L60.83,17.19L60.83,17.19z"/></svg>' : ""}
                                    </div>
                                    ${listener.lastListen ? `<div class="listener-last-listen">${listener.lastListen}</div>` : ''}
                                </div>
                                <a href="${listener.trackUrl}" target="_blank" class="listener-playcount">${listener.playCount.toLocaleString()} play${listener.playCount !== 1 ? 's' : ''}</a>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

            // Restore scroll position
            block.querySelector('.listeners-content-track .listeners-list').scrollTop = YOffset;

            // Add scroll listener to container to pause sortBlocks() when scrolling
            block.querySelector('.listeners-list').addEventListener('scroll', () => {
                store.isScrolling = true;
                clearTimeout(store.scrollTimeoutId);
                store.scrollTimeoutId = setTimeout(() => {
                    store.isScrolling = false;
                }, 3000);
            }, {
                passive: true
            });
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

        listenersContent.innerHTML = `
       <div class="no-listeners">
         <div>Couldn't load listener data.</div>
       </div>`;
        block.dataset.trackListenersLoaded = "0";
    } finally {
        // Show now that images and user data are loaded
        const listenersHeader = block.querySelector(".listeners-header");
        const trackTab = block.querySelector('.listeners-content-track');

        listenersHeader.style.display = 'flex';
        trackTab.style.display = 'flex';
        
        store.isFetchingListeners = false;
    }
}

// Fetch artist listeners
export async function fetchArtistListeners(block, key = store.keys.KEY3) {
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

    store.isFetchingListeners = true;

    const artistName = block.querySelector(".artist-title > a").innerText;
    const username = block.dataset.username;
    
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

                if (
                    !friendData.error &&
                    parseInt(friendData?.artist.stats.userplaycount)
                ) {
                    const playCount = parseInt(friendData.artist.stats.userplaycount);
                    const friendImageUrl =
                        friendBlock.querySelector("#pfp")?.src ||
                        'https://lastfm.freetls.fastly.net/i/u/avatar170s/818148bf682d429dc215c1705eb27b98.png';

                    // Find last listen time from chart data
                    let lastListenTime = null;
                    if (chartDataPerUser[friendUsername]?.recentTracks) {
                        const tracks = chartDataPerUser[friendUsername].recentTracks;
                        for (let track of tracks) {
                            if (track.artist.name === artistName) {
                                if (track.date?.uts) {
                                    lastListenTime = formatTimeAgo(track.date.uts);
                                    break;
                                }
                            }
                        }
                    }

                    return {
                        username: friendUsername,
                        playCount,
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

        // Reselect listeners content container in case it changed from updateAllBlocks()
        block = document.querySelector(`.block[data-username="${username}"]`);
        
        // Check if artist tab is still active before appending to DOM
        const artistTab = block.querySelector('.listeners-tab[data-tab="artist"]');
        if (!artistTab.classList.contains('active')) {
            store.isFetchingListeners = false;
            return;
        }
        
        listenersContent = block.querySelector(`.listeners-content-artist`);

        // Append to container
        if (listeners.length > 0) {
            listenersContent.innerHTML = `
                <div class="listeners-list">
                    ${listeners.map(listener => `
                        <div class="listener-item">
                            <img class="listener-pfp" src="${listener.imageUrl}">
                            <div class="listener-info">
                                <div class="listener-username">
                                    <div>
                                        <a href="${listener.userUrl}" target="_blank">${listener.username}</a>
                                    </div>
                                    ${listener.lastListen ? `<div class="listener-last-listen">${listener.lastListen}</div>` : ''}
                                </div>
                                <a href="${listener.artistUrl}" target="_blank" class="listener-playcount">${listener.playCount.toLocaleString()} play${listener.playCount !== 1 ? 's' : ''}</a>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

            // Restore scroll position
            block.querySelector('.listeners-content-artist .listeners-list').scrollTop = YOffset;

            // Add scroll listener to container to pause sortBlocks() when scrolling
            block.querySelector('.listeners-content-artist .listeners-list').addEventListener('scroll', () => {
                store.isScrolling = true;
                clearTimeout(store.scrollTimeoutId);
                store.scrollTimeoutId = setTimeout(() => {
                    store.isScrolling = false;
                }, 3000);
            }, {
                passive: true
            });
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

        listenersContent.innerHTML = `
       <div class="no-listeners">
         <div>Couldn't load listener data.</div>
       </div>`;
        block.dataset.artistListenersLoaded = "0";
    } finally {
        store.isFetchingListeners = false;
    }
}