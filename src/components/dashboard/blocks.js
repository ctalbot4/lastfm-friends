import { store } from "../../state/store.js";
import * as lastfm from "../../api/lastfm.js";
import { updateProgress } from "./progress.js";
import { getUsernameFromURL } from "../../ui/dom.js";
import { setupBlocks } from "./index.js";
import { handleScroll } from "../preview/index.js";

// Create a block with user info
export function createBlock(user, mainUser = false) {
    const username = user.name;
    const userUrl = user.url;
    const imageUrl = user.image[3]["#text"];
    const blockDiv = document.createElement("div");
    blockDiv.classList.add("block");
    if (mainUser) blockDiv.classList.add("main-user");
    blockDiv.setAttribute("data-username", username);

    const blockHTML = `
    <div class="user-info">
        <div class="profile-picture">
            <a href="${userUrl}" target="_blank">
                <img id="pfp" src="${imageUrl || 'https://lastfm.freetls.fastly.net/i/u/avatar170s/818148bf682d429dc215c1705eb27b98.png'}">
            </a>
        </div>
        <div class="username"><a href=${userUrl} target="_blank">${username}</a></div>
            <div class="info-button">
                 <img src="icons/friends.svg">
            </div>
    </div>
    <div class="listeners-container">
        <div class="listeners-header">
            <div class="listeners-title">Who listens to this track?</div>
            <div class="close-listeners">
                <svg viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            </div>
        </div>
        <div class="listeners-content">

        </div>
    </div>
    <div class="bottom">
        <div class="track-info">
            <div class="song-title">
                <a href="" target="_blank">
                    <span class="rest"></span>
                    <span class="no-break">
                        <svg class="heart-icon" viewBox="0 0 120 120" fill="white">
                        <path class="st0" d="M60.83,17.19C68.84,8.84,74.45,1.62,86.79,0.21c23.17-2.66,44.48,21.06,32.78,44.41 c-3.33,6.65-10.11,14.56-17.61,22.32c-8.23,8.52-17.34,16.87-23.72,23.2l-17.4,17.26L46.46,93.56C29.16,76.9,0.95,55.93,0.02,29.95 C-0.63,11.75,13.73,0.09,30.25,0.3C45.01,0.5,51.22,7.84,60.83,17.19L60.83,17.19L60.83,17.19z"/>
                        </svg>
                    </span>
                </a>
            </div>
            <div class="artist-title">
                <a href="" target="_blank"></a>
            </div>
        </div>
        <div class="status">     
            <span class="time"></span>               
            <img src="icons/playing.gif" class="playing-icon">
        </div>
    </div>
`;
    blockDiv.innerHTML = blockHTML;
    return blockDiv;
}

const userPlayCounts = {};

// Fetch data for a block and update
async function updateBlock(block, retry = false, key = store.keys.KEY) {
    const username = block.dataset.username;
    const oneWeekAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
    const newBlock = block.cloneNode(true);
    try {
        const data = await lastfm.getRecentTracks(username, key, oneWeekAgo);
        updateProgress();
        if (data.recenttracks["@attr"]["total"] == 0) {
            // Remove if no tracks played
            return null;
        } else {
            newBlock.classList.remove("removed");
        }
        userPlayCounts[username] = parseInt(data.recenttracks["@attr"].total);

        const recentTrack = data.recenttracks.track[0];
        const trimmedName = recentTrack.name.trim();
        const oldName = (`${block.querySelector('.song-title .rest').innerText}${block.querySelector('.song-title .rest').innerText ? " " : ""}${block.querySelector('.song-title .no-break').innerText}`).trim();

        // Reset block if track changes
        if (trimmedName != oldName) {
            newBlock.dataset.previewTime = 0;
            newBlock.dataset.listenersLoaded = "0";
            newBlock.dataset.reset = "true";
            newBlock.querySelector(".listeners-container").classList.remove("active");
        }

        // Workaround for heart icon wrapping incorrectly
        const lastSpaceIndex = trimmedName.lastIndexOf(" ");

        let frontString;
        let backString;

        if (lastSpaceIndex === -1) {
            frontString = "";
            backString = trimmedName;
        } else {
            frontString = trimmedName.slice(0, lastSpaceIndex);
            backString = trimmedName.slice(lastSpaceIndex + 1);
        }

        const songLink = recentTrack.url;
        const artistLink = songLink.split("/_")[0];

        newBlock.querySelector(".bottom > .track-info > .song-title > a").innerHTML = `
                        <span class="rest">${frontString}</span>
                        <span class="no-break">${backString}<svg class="heart-icon" viewBox="0 0 120 120" fill="white">
                            <path class="st0" d="M60.83,17.19C68.84,8.84,74.45,1.62,86.79,0.21c23.17-2.66,44.48,21.06,32.78,44.41 c-3.33,6.65-10.11,14.56-17.61,22.32c-8.23,8.52-17.34,16.87-23.72,23.2l-17.4,17.26L46.46,93.56C29.16,76.9,0.95,55.93,0.02,29.95 C-0.63,11.75,13.73,0.09,30.25,0.3C45.01,0.5,51.22,7.84,60.83,17.19L60.83,17.19L60.83,17.19z"/>
                            </svg></span>`;
        newBlock.querySelector(".bottom > .track-info > .artist-title > a").innerText = recentTrack.artist.name;
        newBlock.querySelector(".bottom > .track-info > .song-title > a").href = songLink;
        newBlock.querySelector(".bottom > .track-info > .artist-title > a").href = artistLink;

        const imageUrl = recentTrack.image[3]["#text"];
        newBlock.style.backgroundImage = `url(${imageUrl})`;

        const nowPlaying = recentTrack["@attr"]?.nowplaying;
        const timeSpan = newBlock.querySelector(".time");

        if (recentTrack.loved === "0") {
            newBlock.querySelector(".heart-icon").classList.add("removed");
        } else {
            newBlock.querySelector(".heart-icon").classList.remove("removed");
        }

        if (nowPlaying) {
            newBlock.dataset.nowPlaying = "true";
            newBlock.dataset.date = Math.floor(Date.now() / 1000);
        } else {
            newBlock.dataset.nowPlaying = "false";
            newBlock.dataset.date = recentTrack.date.uts;
            const diff = Math.floor((Date.now() - (newBlock.dataset.date * 1000)) / 1000);

            if (diff < 60) {
                timeSpan.innerText = "Just now";
            } else if (diff < 60 * 60) {
                const minutes = Math.floor(diff / 60);
                timeSpan.innerText = `${minutes}m ago`;
            } else if (diff < 60 * 60 * 24) {
                const hours = Math.floor(diff / (60 * 60));
                timeSpan.innerText = `${hours}h ago`;
            } else if (diff < 60 * 60 * 24 * 365) {
                const days = Math.floor(diff / (60 * 60 * 24));
                timeSpan.innerText = `${days}d ago`;
            } else {
                const years = Math.floor(diff / (60 * 60 * 24 * 365));
                timeSpan.innerText = `${years}y ago`;
            }
        }
    } catch (error) {
        newBlock.classList.add("removed");

        if (error.data) {
            console.error(`API error ${error.data.error} for user ${username}:`, error.data.message);
            if (error.data?.error === 17) {
                // Remove if private user
                return null;
            } else if (error.data?.error === 8 && retry == false) {
                return updateBlock(block, true);
            } else if (error.data?.error === 29) {
                gtag('event', 'rate_limit-general', {});
            }
        } else {
            console.error(`Error updating ${username}:`, error);
        }
    }
    newBlock.dataset.previewPlaying = block.dataset.previewPlaying || "false";

    return newBlock;
}

// Sort blocks then replace old ones
async function sortBlocks(blocks) {
    const username = getUsernameFromURL().toLowerCase();
    blocks.sort((x, y) => {
        const xUsername = x.dataset.username.toLowerCase();
        const yUsername = y.dataset.username.toLowerCase();
        const xNowPlaying = x.dataset.nowPlaying === "true";
        const yNowPlaying = y.dataset.nowPlaying === "true";
        const xDate = parseInt(x.dataset.date, 10) || 0;
        const yDate = parseInt(y.dataset.date, 10) || 0;

        if (xUsername === username && xNowPlaying) {
            return -1;
        } else if (yUsername === username && yNowPlaying) {
            return 1;
        } else if (xNowPlaying && !yNowPlaying) {
            return -1;
        } else if (!xNowPlaying && yNowPlaying) {
            return 1;
        } else if (xNowPlaying && yNowPlaying) {
            return xUsername.localeCompare(yUsername);
        } else {
            return yDate - xDate;
        }
    });

    // If user is scrolling, wait to rebuild DOM
    while (store.isScrolling) {
        await new Promise(r => setTimeout(r, 100));
    }

    // Save scroll positions inside listeners-container and reapply them after rebuilding
    const scrollPositions = {};

    document.querySelectorAll('.listeners-list').forEach(list => {
        const block = list.closest('.block');
        if (!block) return;
        scrollPositions[block.dataset.username] = list.scrollTop;
    });

    const container = document.getElementById("block-container");
    container.innerHTML = "";
    blocks.forEach(block => {
        container.appendChild(block);
    });
    blocks.forEach(block => {
        const name = block.dataset.username;
        const domList = document.querySelector(
            `.block[data-username="${name}"] .listeners-list`
        );
        if (domList && scrollPositions[name] != null) {
            domList.scrollTop = scrollPositions[name];
        }
    });
}

// Update all blocks
export async function updateAllBlocks() {
    // Wait for listeners fetch to complete
    while (store.isFetchingListeners) {
        await new Promise(r => setTimeout(r, 100));
    }
    const blockContainer = document.getElementById("block-container");
    const blocks = blockContainer.getElementsByClassName("block");
    const blocksArr = Array.from(blocks);

    store.completed = 0;

    const chunks = [];
    const newBlocks = [];

    chunks.push(blocksArr.slice(0, 250));
    const blockPromises = await Promise.all(chunks[0].map(block => updateBlock(block)));
    newBlocks.push(...blockPromises);

    // Update second chunk if necessary
    if (store.friendCount > 250) {
        await new Promise(resolve => setTimeout(resolve, 8000));
        chunks.push(blocksArr.slice(250, 500));
        const blockPromises = await Promise.all(chunks[1].map(block => updateBlock(block, false, store.keys.KEY2)));
        newBlocks.push(...blockPromises);
    }

    const newerBlocks = [];

    // Sync values from original blocks that user might've changed during update and ignore null blocks
    newBlocks.forEach((newBlock, index) => {
        if (newBlock) {
            const originalBlock = blocks[index];
            newBlock.dataset.previewPlaying = originalBlock.dataset.previewPlaying || "false";
            if (newBlock.dataset.previewTime != 0) {
                newBlock.dataset.previewTime = originalBlock.dataset.previewTime;
            }
            // Sync listeners-container status if listeners have been loaded (user has clicked info button, and track hasn't changed)
            if (newBlock.dataset.reset == "true") {
                delete newBlock.dataset.reset;
            } else if (originalBlock.dataset.listenersLoaded != "0") {
                newBlock.querySelector(".listeners-container").className = originalBlock.querySelector(".listeners-container").className;
            }
            newBlock.querySelector(".listeners-container").innerHTML = originalBlock.querySelector(".listeners-container").innerHTML;

            newerBlocks.push(newBlock);
        }
    });

    // Call sortBlocks after all updates are done
    await sortBlocks(newerBlocks);

    // Update now playing count
    const nowPlayingCount = document.querySelectorAll('.block[data-now-playing="true"]').length;
    const nowPlayingElements = document.querySelectorAll('.ticker-friends > .value');
    nowPlayingElements.forEach(element => {
        element.textContent = `${nowPlayingCount} friend${nowPlayingCount !== 1 ? 's' : ''}`;
    });

    // Update total plays
    const totalPlays = Object.values(userPlayCounts).reduce((sum, count) => sum + count, 0);

    // Trigger mobile scroll handler
    handleScroll();

    // Counting animation
    const startPlays = parseInt(document.querySelector(".ticker-plays > .value").innerText);
    if (startPlays) {
        let startTime = null;
        const duration = store.updateTimers.blocks.interval;

        function updateCounter(currentTime) {
            if (!startTime) startTime = currentTime;
            const elapsedTime = currentTime - startTime;
            const progress = Math.min(elapsedTime / duration, 1);
            const currentNumber = Math.floor(progress * (totalPlays - startPlays) + startPlays);
            document.querySelectorAll(".ticker-plays > .value").forEach(element => {
                element.innerText = currentNumber;
            });

            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            }
        }

        requestAnimationFrame(updateCounter);
    } else {
        document.querySelectorAll(".ticker-plays > .value").forEach(element => {
            element.innerText = totalPlays;
        });
    }

    store.updateTimers.blocks.lastUpdate = Date.now();

    // Cache blocks, ticker, charts
    try {
        localStorage.setItem(store.cacheKeys.blocks, blockContainer.innerHTML);
    } catch (e) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
            console.warn('LocalStorage quota exceeded. Clearing storage...');

            const scheduleData = localStorage.getItem(store.cacheKeys.schedule);
            const friendsData = localStorage.getItem(store.cacheKeys.friends);
            const tickerData = localStorage.getItem(store.cacheKeys.ticker);

            localStorage.clear();

            localStorage.setItem(store.cacheKeys.schedule, scheduleData);
            localStorage.setItem(store.cacheKeys.friends, friendsData);
            localStorage.setItem(store.cacheKeys.ticker, tickerData);
            localStorage.setItem(store.cacheKeys.blocks, blockContainer.innerHTML);
            localStorage.setItem("visited", true);
        }
    }
    const chartsDiv = document.querySelector(".charts-scrollable");
    const tickerDiv = document.querySelector(".ticker-stats");

    const tickerData = {
        charts: chartsDiv.innerHTML,
        ticker: tickerDiv.innerHTML
    }
    try {
        localStorage.setItem(store.cacheKeys.ticker, JSON.stringify(tickerData));
    } catch (e) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
            console.warn('LocalStorage quota exceeded. Clearing storage...');

            const scheduleData = localStorage.getItem(store.cacheKeys.schedule);
            const friendsData = localStorage.getItem(store.cacheKeys.friends);
            const blocksData = localStorage.getItem(store.cacheKeys.blocks);

            localStorage.clear();

            localStorage.setItem(store.cacheKeys.schedule, scheduleData);
            localStorage.setItem(store.cacheKeys.friends, friendsData);
            localStorage.setItem(store.cacheKeys.ticker, JSON.stringify(tickerData));
            localStorage.setItem(store.cacheKeys.blocks, blocksData);
            localStorage.setItem("visited", true);
        }
    }
    setupBlocks();
    console.log(`Refreshed ${store.friendCount + 1} users!`);
}