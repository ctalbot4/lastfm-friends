// State
import { store, getKey } from "../state/store.js";

// API
import * as lastfm from "../api/lastfm.js";

// Blocks
import { createBlock } from "./blocks/create.js";
import { setupBlocks } from "./blocks/index.js";
import { updateAllBlocks } from "./blocks/update.js";

// Cache
import { getData } from "./cache.js";

// Charts
import { initCharts } from "./charts/index.js";
import { calculateListeningTime } from "./charts/update.js";

// Charts - Network
import { tryNetworkUpdate } from "./charts/network/data.js";

// Ticker
import { startTicker } from "./charts/ticker.js";

// Schedule
import { scheduleUpdates, cancelUpdates } from "./schedule.js";

// UI
import { getUsernameFromURL } from "../ui/dom.js";

const blockContainer = document.getElementById("block-container");

export async function initDashboard() {
    document.title = `${getUsernameFromURL()} | lastfmfriends.live`;

    await initialFetch();

    await Promise.all([
        store.foundListeningCache ? null : calculateListeningTime(),
        store.foundBlocksCache ? null : updateAllBlocks()
    ].filter(Boolean));

    document.getElementById("block-container").classList.remove("hidden");
    document.getElementById("mobile-toggle").classList.remove("removed");
    document.getElementById("stats-ticker").classList.remove("hidden");
    document.getElementById("progress-container").classList.add("removed");

    scheduleUpdates();
    setupBlocks();
    initCharts();
    
    // Start ticker after blocks are updated
    startTicker();

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            scheduleUpdates();
            tryNetworkUpdate();
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
async function initialFetch() {
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

        store.friendCount = Math.min(parseInt(friendsData.friends["@attr"].total, 10), parseInt(friendsData.friends["@attr"].perPage, 10)) + 1;
        const friends = friendsData.friends.user;

        // Set conservative refreshes to try to avoid API rate limit
        store.updateTimers.blocks.interval = Math.max(5000, (store.friendCount / 5) * 1200);
        store.updateTimers.listening.interval = Math.max(180000, (store.friendCount / 5) * 5 * 3000);

        // Get secondary key if necessary
        if (store.friendCount > 200) {
            store.keys.KEY2 = await getKey(2);
        }

        const cachedSchedule = await getData('schedule', store.username);
        if (cachedSchedule) {
            const {
                blocks,
                listening
            } = cachedSchedule;
            store.updateTimers.blocks.lastUpdate = blocks;
            store.updateTimers.listening.lastUpdate = listening;
        }
        friends.forEach((friend) => {
            blockContainer.appendChild(createBlock(friend));
        });
    } catch (error) {
        console.error("Error during initial fetch:", error);
        document.getElementById("error-popup").classList.remove("removed");
        localStorage.clear();
    }
}