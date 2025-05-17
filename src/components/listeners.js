// API
import * as lastfm from "../api/lastfm.js";

// State
import { store } from "../state/store.js";

// Fetch track listeners
export async function fetchTrackListeners(block, key = store.keys.KEY3) {
    // Set listeners loaded value to intermediate "1" (loading in progress)
    block.dataset.listenersLoaded = "1";
    store.isFetchingListeners = true;

    const artistName = block.querySelector(".artist-title > a").innerText;
    const trackName = block.querySelector(".song-title > a").innerText.replace(/<svg.*<\/svg>/g, '').trim();
    const username = block.dataset.username;

    let listenersContent = block.querySelector(".listeners-content");

    // Show loading message
    listenersContent.innerHTML = `
        <div class="listeners-loading">
            <div>Loading listeners...</div>
        </div>
    `;

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

                    return {
                        username: friendUsername,
                        playCount,
                        loved,
                        imageUrl: friendImageUrl,
                        url: `https://www.last.fm/user/${friendUsername}/library/music/${encodeURIComponent(artistName)}/_/${encodeURIComponent(trackName)}`
                    };
                }
            } catch (e) {
                // If we've been rate limited, show message
                if (e.code === 29) {
                    rateLimited = true;
                    listenersContent = block.querySelector(`.block[data-username="${username}"] .listeners-content`);
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

        // Reselect listeners content container in case it changed from updateAllBlocks()
        block = document.querySelector(`.block[data-username="${username}"]`);
        listenersContent = block.querySelector(`.listeners-content`);

        // Append to container
        if (listeners.length > 0) {
            listenersContent.innerHTML = `
                <div class="listeners-list">
                    ${listeners.map(listener => `
                        <div class="listener-item">
                            <img class="listener-pfp" src="${listener.imageUrl}">
                            <div class="listener-info">
                                <div class="listener-username">
                                    <a href="${listener.url}" target="_blank">${listener.username}</a>
                                    ${listener.loved ? '<svg class="listener-heart" viewBox="0 0 120 120" fill="white"><path class="st0" d="M60.83,17.19C68.84,8.84,74.45,1.62,86.79,0.21c23.17-2.66,44.48,21.06,32.78,44.41 c-3.33,6.65-10.11,14.56-17.61,22.32c-8.23,8.52-17.34,16.87-23.72,23.2l-17.4,17.26L46.46,93.56C29.16,76.9,0.95,55.93,0.02,29.95 C-0.63,11.75,13.73,0.09,30.25,0.3C45.01,0.5,51.22,7.84,60.83,17.19L60.83,17.19L60.83,17.19z"/></svg>' : ""}
                                </div>
                                <div class="listener-playcount">${listener.playCount} play${listener.playcount !== 1 ? 's' : ''}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

            // Add scroll listener to container to pause sortBlocks when scrolling
            block.querySelector('.listeners-list').addEventListener('scroll', () => {
                store.isScrolling = true;
                clearTimeout(store.scrollTimeoutId);
                store.scrollTimeoutId = setTimeout(() => {
                    store.isScrolling = false;
                }, 100);
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

        store.isFetchingListeners = false;

        // Set listeners loaded dataset value to "2" (loading complete)
        block.dataset.listenersLoaded = "2";
    } catch (error) {
        console.error("Error fetching track listeners:", error);

        listenersContent.innerHTML = `
       <div class="no-listeners">
         <div>Couldn't load listener data.</div>
       </div>`;
    }
}