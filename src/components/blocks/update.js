// State
import { store } from "../../state/store.js";

// API
import * as lastfm from "../../api/lastfm.js";

// Blocks
import { setupBlocks } from "./index.js";
import { sortBlocks } from "./sort.js";

// Cache
import { cacheBlocks, cacheChartsHTML } from "../cache.js";

// Charts - Graphs
import { updateActivityCharts, updateActivityData, resetActivityData } from "../charts/graphs/data.js";

// Charts - Lists
import { createTopListenersChart } from "../charts/lists/lists.js";

// Charts - Scatter
import { resetScatterData, tryScatterUpdate, updateScatterData } from "../charts/scatter/data.js";

// UI
import { handleScroll } from "../preview/index.js";
import { updateProgress, updateProgressText } from "../../ui/progress.js";

export const userPlayCounts = {};

// Fetch data for a block and update
async function updateBlock(block, retry = false, key = store.keys.KEY) {
    const username = block.dataset.username;
    const oneWeekAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
    const newBlock = block.cloneNode(true);
    try {
        const data = await lastfm.getRecentTracks(username, key, oneWeekAgo);

        updateProgress("history", username);

        if (data.recenttracks["@attr"]["total"] == 0) {
            // Remove if no tracks played
            return null;
        } else {
            newBlock.classList.remove("removed");
        }

        // Pass user's tracks to charts
        updateActivityData(data.recenttracks.track, username);
        updateScatterData(data.recenttracks.track, username);

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
    store.isUpdatingBlocks = true;

    // Start charts processing
    resetActivityData();
    resetScatterData();

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
            // Sync listeners-container status if listeners have been loaded 
            // (user has clicked info button, and track hasn't changed)
            if (newBlock.dataset.reset == "true") {
                delete newBlock.dataset.reset;
            } else if (originalBlock.dataset.listenersLoaded != "0") {
                newBlock.querySelector(".listeners-container").className =
                    originalBlock.querySelector(".listeners-container").className;
            }
            newBlock.querySelector(".listeners-container").innerHTML =
                originalBlock.querySelector(".listeners-container").innerHTML;

            // Preserve info button hover state
            if (originalBlock.matches(':hover')) {
                newBlock.querySelector(".info-button").style.opacity = "1";
                newBlock.addEventListener('mouseout', () => {
                    newBlock.querySelector(".info-button").style.opacity = "";
                }, {
                    once: true
                });
            } else {
                newBlock.querySelector(".info-button").style.opacity = "";
            }

            newerBlocks.push(newBlock);
        }
    });

    // Call sortBlocks after all updates are done
    await sortBlocks(newerBlocks);

    // Async functions all done
    store.isUpdatingBlocks = false;

    // Signal that charts ready to update
    updateActivityCharts();
    tryScatterUpdate();
    updateProgressText();

    // Wait for charts to finish updating
    while (store.isUpdatingCharts) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Update now playing count
    const nowPlayingCount = document.querySelectorAll('.block[data-now-playing="true"]').length;
    const nowPlayingElements = document.querySelectorAll('.ticker-friends > .value');
    nowPlayingElements.forEach(element => {
        element.textContent = `${nowPlayingCount} friend${nowPlayingCount !== 1 ? 's' : ''}`;
    });

    // Update total plays
    const totalPlays = Object.values(userPlayCounts).reduce((sum, count) => sum + count, 0);

    // Update top listeners chart
    const listenersList = document.querySelector("#listeners-section .users-list");
    listenersList.innerHTML = '';
    const listeners = createTopListenersChart();
    listeners.forEach(item => listenersList.appendChild(item));

    // Trigger mobile scroll handler
    handleScroll();

    // Counting animation if % change < 5%
    const startPlays = parseInt(document.querySelector(".ticker-plays > .value").innerText);
    if (startPlays && Math.abs((totalPlays - startPlays) / (1 + startPlays)) < 0.05) {
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

    cacheBlocks();
    cacheChartsHTML();
    setupBlocks();
    console.log(`Refreshed ${store.friendCount + 1} users!`);
}