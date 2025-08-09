// State
import { store, getKey } from "../state/store.js";

// API
import * as lastfm from "../api/lastfm.js";

// Blocks
import { createBlock } from "./blocks/create.js";
import { setupBlocks } from "./blocks/index.js";
import { updateAllBlocks } from "./blocks/update.js";

// Cache
import { cacheFriends, getCachedBlocks, getCachedChartsHTML, getCachedFriends, getData } from "./cache.js";

// Charts
import { initCharts } from "./charts/index.js";
import { updateCharts } from "./charts/update.js";

// Schedule
import { scheduleUpdates, cancelUpdates } from "./schedule.js";

// UI
import { getUsernameFromURL } from "../ui/dom.js";

const blockContainer = document.getElementById("block-container");

function formatCacheTime(milliseconds) {
    const totalSeconds = Math.floor(Math.abs(milliseconds) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    if (minutes === 0) {
        return `${seconds}s`;
    } else if (seconds === 0) {
        return `${minutes}m`;
    } else {
        return `${minutes}m ${seconds}s`;
    }
}

export async function initDashboard() {
    document.title = `${getUsernameFromURL()} | lastfmfriends.live`;

    await initialFetch();

    await Promise.all([
        store.foundTickerCache ? null : updateCharts(),
        store.foundBlocksCache ? null : updateAllBlocks()
    ].filter(Boolean));

    document.getElementById("block-container").classList.remove("hidden");
    document.getElementById("mobile-toggle").classList.remove("removed");
    document.getElementById("stats-ticker").classList.remove("hidden");
    document.getElementById("progress-container").classList.add("removed");

    scheduleUpdates();
    setupBlocks();
    initCharts();

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            scheduleUpdates();
        } else {
            cancelUpdates();
        }
    });

    // Handle tooltips on first visit
    const chartsToggle = document.getElementById("charts-toggle");
    const soundToggle = document.getElementById("ticker-sound-toggle");
    const mobileToggle = document.getElementById("mobile-toggle");

    if (!localStorage.getItem("visited")) {
        setTimeout(() => {
            chartsToggle.classList.add("tooltip");
        }, 3000);
        setTimeout(() => {
            chartsToggle.classList.remove("tooltip");
        }, 7000);
        setTimeout(() => {
            soundToggle.classList.add("tooltip");
            mobileToggle.classList.add("tooltip");
        }, 9000);
        setTimeout(() => {
            soundToggle.classList.remove("tooltip");
            mobileToggle.classList.remove("tooltip");
        }, 13000);
        setTimeout(() => {
            chartsToggle.classList.add("done");
            soundToggle.classList.add("done");
            mobileToggle.classList.add("done");
            localStorage.setItem("visited", "true");
        }, 15000);
    } else {
        chartsToggle.classList.add("done");
        soundToggle.classList.add("done");
        mobileToggle.classList.add("done");
    }
}

// Initial fetch on load
async function initialFetch(retry = false) {
    store.keys.KEY = await getKey();

    try {
        // Fetch user data
        const userData = await lastfm.getUserInfo(getUsernameFromURL());
        const user = userData.user;

        store.username = user.name;
        document.title = `${user.name} | lastfmfriends.live`;

        store.cacheKeys.friends = `lfl_friends_${user.name}`;
        store.cacheKeys.blocks = `lfl_blocks_${user.name}`;
        store.cacheKeys.ticker = `lfl_ticker_${user.name}`;
        store.cacheKeys.schedule = `lfl_schedule_${user.name}`;

        gtag('event', 'page_view', {
            'page_title': document.title,
            'page_location': window.location.href,
            'page_path': window.location.pathname
        });

        blockContainer.appendChild(createBlock(user, true));

        // Fetch friends data
        const friendsData = await lastfm.getFriends(store.username, store.keys.KEY, 500);

        store.friendCount = Math.min(parseInt(friendsData.friends["@attr"].total, 10), parseInt(friendsData.friends["@attr"].perPage, 10));
        const friends = friendsData.friends.user;

        // Set conservative refreshes to try to avoid API rate limit
        store.updateTimers.blocks.interval = Math.max(5000, (store.friendCount / 5) * 1200);
        store.updateTimers.charts.interval = Math.max(270000, (store.friendCount / 5) * 9 * 3000);

        // Get secondary key if necessary
        if (store.friendCount > 250) {
            store.keys.KEY2 = await getKey(2);
        }

        const cachedFriends = await getCachedFriends();

        if (cachedFriends) {
            const list = [];
            friends.forEach(friend => {
                list.push(friend.name);
            });
            if (JSON.stringify(list) === JSON.stringify(cachedFriends)) {
                const cachedSchedule = await getData('schedule', store.username);
                if (cachedSchedule) {
                    const {
                        blocks,
                        charts
                    } = cachedSchedule;
                    store.updateTimers.blocks.lastUpdate = blocks;
                    store.updateTimers.charts.lastUpdate = charts;

                    const now = Date.now();

                    // Calculate time when the next update should occur
                    let nextBlockUpdateTime = store.updateTimers.blocks.lastUpdate + store.updateTimers.blocks.interval;
                    let blocksDelay = nextBlockUpdateTime - now;

                    if (blocksDelay > 0) {
                        const cachedBlocks = await getCachedBlocks();
                        if (cachedBlocks) {
                            blockContainer.innerHTML = cachedBlocks;
                            const cacheAge = now - store.updateTimers.blocks.lastUpdate;
                            console.log(`Loaded blocks from cache (${formatCacheTime(cacheAge)} ago, next update in ${formatCacheTime(blocksDelay)}).`);
                            store.foundBlocksCache = true;
                        }
                    }

                    let nextChartsUpdateTime = store.updateTimers.charts.lastUpdate + store.updateTimers.charts.interval;
                    let chartsDelay = nextChartsUpdateTime - now;

                    if (chartsDelay > 0) {
                        const chartsHTMLCache = await getCachedChartsHTML();
                        if (chartsHTMLCache) {
                            const ticker = chartsHTMLCache.ticker || '';
                            const charts = chartsHTMLCache.charts || '';

                            const tickerDiv = document.querySelector(".ticker-stats");
                            const scrollDiv = document.querySelector(".ticker-scroll");
                            const chartsDiv = document.querySelector(".charts-scrollable");

                            tickerDiv.innerHTML = ticker;
                            scrollDiv.innerHTML = ticker;
                            chartsDiv.innerHTML = charts;

                            updateCharts(true);

                            store.foundTickerCache = true;
                            const cacheAge = now - store.updateTimers.charts.lastUpdate;
                            console.log(`Loaded charts from cache (${formatCacheTime(cacheAge)} ago, next update in ${formatCacheTime(chartsDelay)}).`);
                        }
                    }
                }
            }
        }
        cacheFriends(friends);
        if (!store.foundBlocksCache) {
            friends.forEach((friend) => {
                blockContainer.appendChild(createBlock(friend));
            });
        }
    } catch (error) {
        if (!retry) {
            console.log("First request failed, retrying...");
            blockContainer.innerHTML = '';
            await initialFetch(true);
        } else {
            console.error("Error during initial fetch:", error);
            document.getElementById("error-popup").classList.remove("removed");
            localStorage.clear();
        }
    }
}