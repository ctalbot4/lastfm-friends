// State
import { store } from "../../state/store.js";

// API
import * as lastfm from "../../api/lastfm.js";

// Blocks
import { setupBlocks } from "./index.js";
import { sortBlocks } from "./sort.js";

// Charts
import { updateCharts, calculateChartData } from "../charts/update.js";

// Charts - Graphs
import { updateActivityCharts, updateActivityData, resetActivityData } from "../charts/graphs/data.js";

// Charts - Scatter
import { resetScatterData, tryScatterUpdate, updateScatterData } from "../charts/scatter/data.js";

// Charts - Network
import { updateNetworkData } from "../charts/network/data.js";

// UI
import { handleScroll } from "../preview/index.js";
import { updateProgress, updateProgressText } from "../../ui/progress.js";

export let userPlayCounts = {};

export function setUserPlayCounts(playCounts) {
    userPlayCounts = playCounts;
}

// Fetch data for a block and update
async function updateBlock(block, key = store.keys.KEY) {
    if (block.classList.contains("private")) {
        return block;
    }
    const username = block.dataset.username;
    const oneWeekAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
    const newBlock = block.cloneNode(true);
    newBlock.classList.remove("removed");
    try {
        const data = await lastfm.getRecentTracks(username, key, oneWeekAgo);

        if (data.recenttracks["@attr"]["total"] == 0) {
            // Remove if no tracks played
            return null;
        }

        // Get user's entire recent listening history if more than 1 page of tracks
        let tracks = data.recenttracks.track;

        for (let i = 1000; i < data.recenttracks["@attr"]["total"] && i < 5000; i += 1000) {
            const moreData = await lastfm.getRecentTracks(username, key, oneWeekAgo, (i / 1000) + 1);
            tracks.push(...moreData.recenttracks.track);
        }

        // Pass user's tracks to graphs and scatter
        updateActivityData(tracks, username);
        updateScatterData(tracks, username);

        // Calculate list data from recent tracks
        const userChartData = calculateChartData(tracks, username);

        userPlayCounts[username] = parseInt(data.recenttracks["@attr"].total);

        const recentTrack = data.recenttracks.track[0];
        const trimmedName = recentTrack.name.trim();
        const oldName = (`${block.querySelector('.song-title .rest').innerText}${block.querySelector('.song-title .rest').innerText ? " " : ""}${block.querySelector('.song-title .no-break').innerText}`).trim();

        // Reset block if track changes
        if (trimmedName != oldName) {
            newBlock.dataset.previewTime = 0;
            newBlock.dataset.trackListenersLoaded = "0";
            newBlock.dataset.artistListenersLoaded = "0";
            newBlock.dataset.reset = "true";
            newBlock.querySelector(".listeners-container").classList.remove("active");
        }

        // Workaround for heart and star icons wrapping incorrectly
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

        // Check if artist is in user's top 4 weekly artists
        let isTopArtist = false;
        if (userChartData && userChartData.artistPlays) {
            const userArtists = Object.entries(userChartData.artistPlays)
                .sort((a, b) => b[1].plays - a[1].plays)
                .slice(0, 4);
            isTopArtist = userArtists.some(([artistName]) => artistName === recentTrack.artist.name);
        }

        // Check if track is in user's top 8 weekly tracks
        let isTopTrack = false;
        if (userChartData && userChartData.trackPlays) {
            const trackKey = `${trimmedName}::${recentTrack.artist.name}`;
            const userTracks = Object.entries(userChartData.trackPlays)
                .sort((a, b) => b[1].plays - a[1].plays)
                .slice(0, 8);
            isTopTrack = userTracks.some(([key]) => key === trackKey);
        }

        newBlock.querySelector(".bottom > .track-info > .song-title > a").innerHTML = `
                        <span class="rest">${frontString}</span>
                        <span class="no-break">${backString}<svg class="heart-icon${recentTrack.loved === "1" ? '' : ' removed'}" viewBox="0 0 120 120" fill="white"><path class="st0" d="M60.83,17.19C68.84,8.84,74.45,1.62,86.79,0.21c23.17-2.66,44.48,21.06,32.78,44.41 c-3.33,6.65-10.11,14.56-17.61,22.32c-8.23,8.52-17.34,16.87-23.72,23.2l-17.4,17.26L46.46,93.56C29.16,76.9,0.95,55.93,0.02,29.95 C-0.63,11.75,13.73,0.09,30.25,0.3C45.01,0.5,51.22,7.84,60.83,17.19L60.83,17.19L60.83,17.19z"/></svg><img class="star-icon${isTopTrack ? '' : ' removed'}" src="icons/star.png" title="Top 8 track"></span>`;
        newBlock.querySelector(".bottom > .track-info > .artist-title > a").innerHTML = `${recentTrack.artist.name}<img class="star-icon${isTopArtist ? '' : ' removed'}" src="icons/star.png" title="Top 4 artist">`;
        newBlock.querySelector(".bottom > .track-info > .song-title > a").href = songLink;
        newBlock.querySelector(".bottom > .track-info > .artist-title > a").href = artistLink;

        const imageUrl = recentTrack.image[3]["#text"];
        newBlock.style.backgroundImage = `url(${imageUrl})`;

        const nowPlaying = recentTrack["@attr"]?.nowplaying;
        const timeSpan = newBlock.querySelector(".time");

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
            console.error(`API error ${error.data.error} for user ${username}'s activity:`, error.data.message);
            if (error.data?.error === 17) {
                // Remove if private user
                newBlock.classList.add("removed");
                newBlock.classList.add("private");
            }
        } else {
            console.error(`Error updating ${username}:`, error);
        }
    } finally {
        updateProgress("activity", username);
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

    chunks.push(blocksArr.slice(0, 200));
    const blockPromises = await Promise.all(chunks[0].map(block => updateBlock(block)));
    newBlocks.push(...blockPromises);

    // Update second chunk if necessary
    if (store.friendCount > 200) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        chunks.push(blocksArr.slice(200, 400));
        const blockPromises = await Promise.all(chunks[1].map(block => updateBlock(block, store.keys.KEY2)));
        newBlocks.push(...blockPromises);
    }

    // Call sortBlocks after all updates are done
    await sortBlocks(newBlocks);

    // Fetches all done
    store.isUpdatingBlocks = false;
    updateProgressText();

    // Signal that charts ready to update
    updateActivityCharts();
    tryScatterUpdate();

    // Update charts with calculated data
    await updateCharts();

    // Update network data after charts data is calculated
    updateNetworkData();

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

    setupBlocks();
    console.log(`Refreshed ${store.friendCount + 1} users!`);
}