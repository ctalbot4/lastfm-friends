// State
import { store, getKey } from "../../state/store.js";

// API
import * as lastfm from "../../api/lastfm.js";

// UI
import { getUsernameFromURL, organizeBlocksIntoRows } from "../../ui/dom.js";

// Components
import { updateTicker } from "../ticker/update.js";
import { updateAllBlocks } from "./update.js";
import { createBlock } from "./create.js";
import { scheduleUpdates, cancelUpdates } from "../schedule.js";
import { fetchTrackListeners } from "../listeners.js";
import { cacheFriends } from "../cache.js";

const blockContainer = document.getElementById("block-container");

export function initDashboard() {
    document.title = `${getUsernameFromURL()} | lastfmfriends.live`;

    const initialPromise = initialFetch();

    // Call updateAllBlocks after both fetches have completed
    Promise.allSettled([initialPromise])
        .then(async () => {
            await Promise.all([
                store.foundTickerCache ? null : updateTicker(),
                store.foundBlocksCache ? null : updateAllBlocks()
            ].filter(Boolean));

            const rows = organizeBlocksIntoRows();

            document.getElementById("block-container").classList.remove("hidden");
            document.getElementById("mobile-toggle").classList.remove("removed");
            document.getElementById("stats-ticker").classList.remove("hidden");
            document.getElementById("progress-container").classList.add("removed");

            scheduleUpdates();
            setupBlocks();

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
        });

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            scheduleUpdates();
        } else {
            cancelUpdates();
        }
    });
}

// Initial fetch on load
async function initialFetch() {
    store.keys.KEY = await getKey();

    try {
        // Fetch user data
        const userData = await lastfm.getUserInfo(getUsernameFromURL());
        const user = userData.user;

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
        const friendsData = await lastfm.getFriends(getUsernameFromURL(), store.keys.KEY, 500);

        store.friendCount = Math.min(parseInt(friendsData.friends["@attr"].total, 10), parseInt(friendsData.friends["@attr"].perPage, 10));
        const friends = friendsData.friends.user;

        // Set conservative refreshes to try to avoid API rate limit
        store.updateTimers.blocks.interval = Math.max(10000, (store.friendCount / 5) * 1500);
        store.updateTimers.ticker.interval = Math.max(270000, (store.friendCount / 5) * 9 * 3000);

        // Get secondary key if necessary
        if (store.friendCount > 250) {
            store.keys.KEY2 = await getKey(2);
        }

        const cachedFriends = localStorage.getItem(store.cacheKeys.friends);

        if (cachedFriends) {
            const parsedFriends = JSON.parse(cachedFriends);
            if (JSON.stringify(friends) === JSON.stringify(parsedFriends)) {
                const cachedSchedule = localStorage.getItem(store.cacheKeys.schedule);
                if (cachedSchedule) {
                    const {
                        blocks,
                        ticker
                    } = JSON.parse(cachedSchedule);
                    store.updateTimers.blocks.lastUpdate = blocks;
                    store.updateTimers.ticker.lastUpdate = ticker;

                    const now = Date.now();

                    // Calculate time when the next update should occur
                    let nextBlockUpdateTime = store.updateTimers.blocks.lastUpdate + store.updateTimers.blocks.interval;
                    let blocksDelay = nextBlockUpdateTime - now;

                    if (blocksDelay > 0) {
                        const cachedBlocks = localStorage.getItem(store.cacheKeys.blocks);
                        if (cachedBlocks) {
                            blockContainer.innerHTML = cachedBlocks;
                            console.log("Loaded blocks from cache.");
                            store.foundBlocksCache = true;
                        }
                    }

                    let nextTickerUpdateTime = store.updateTimers.ticker.lastUpdate + store.updateTimers.ticker.interval;
                    let tickerDelay = nextTickerUpdateTime - now;

                    if (tickerDelay > 0) {
                        const tickerCache = JSON.parse(localStorage.getItem(store.cacheKeys.ticker));
                        if (tickerCache) {
                            const ticker = tickerCache?.ticker || '';
                            const charts = tickerCache?.charts || '';
                            const tickerDiv = document.querySelector(".ticker-stats");
                            const scrollDiv = document.querySelector(".ticker-scroll");
                            const chartsDiv = document.querySelector(".charts-scrollable");

                            tickerDiv.innerHTML = ticker;
                            scrollDiv.innerHTML = ticker;
                            chartsDiv.innerHTML = charts;

                            store.foundTickerCache = true;
                            console.log("Loaded ticker from cache.");
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
        console.error("Error during initial fetch:", error);
        document.getElementById("error-popup").classList.remove("removed");
        localStorage.clear();
    }
}

// Setup blocks on initial load and when blocks are rebuilt in sortBlocks()
export function setupBlocks() {
    const blocks = document.querySelectorAll(`.block`);

    blocks.forEach(block => {
        if (!block) return;
        const infoButton = block.querySelector(".info-button");
        const closeButton = block.querySelector(".close-listeners");
        const listenersContainer = block.querySelector(".listeners-container");

        infoButton.addEventListener("click", async (e) => {
            e.preventDefault();

            listenersContainer.classList.add("active");
            blocks.forEach(otherBlock => {
                if (otherBlock == block) return;
                otherBlock.querySelector(".listeners-container").classList.remove("active");
            })

            // Fetch listeners data if not already fetched
            if (block.dataset.listenersLoaded != "2") {
                if (!store.keys.KEY3) store.keys.KEY3 = await getKey(3);
                await fetchTrackListeners(block);
            }
        });

        closeButton.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            listenersContainer.classList.remove("active");
        });

        // Add scroll listeners to any active listeners-lists
        document.querySelectorAll('.listeners-list').forEach(list => {
            list.addEventListener('scroll', () => {
                store.isScrolling = true;
                clearTimeout(store.scrollTimeoutId);
                store.scrollTimeoutId = setTimeout(() => {
                    store.isScrolling = false;
                }, 100);
            }, {
                passive: true
            });
        });
    })
}