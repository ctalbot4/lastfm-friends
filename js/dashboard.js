function getUsernameFromURL() {
    const hash = window.location.hash;
    const username = hash.substring(1);
    return username;
}

const progressBar = document.getElementById("progress-bar");

function updateProgress() {
    completed++;
    const progress = ((completed + 1) / ((friendCount + 1) * 4)) * 100;
    progressBar.style.width = progress + "%";
}

// Create a block with user info
function createBlock(user) {
    const username = user.name;
    const userUrl = user.url;
    const imageUrl = user.image[3]["#text"];
    const blockDiv = document.createElement("div");
    blockDiv.className = "block";
    blockDiv.setAttribute("data-username", username);

    const blockHTML = `
        <div class="user-info">
            <div class="profile-picture">
                <a href="${userUrl}" target="_blank">
                    <img id="pfp" src="${imageUrl || 'https://lastfm.freetls.fastly.net/i/u/avatar170s/818148bf682d429dc215c1705eb27b98.png'}">
                </a>
            </div>
            <div class="username"><a href=${userUrl} target="_blank">${username}</a></div>
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

let completed = 0;
const userPlayCounts = {};

// Fetch data for a block and update
async function updateBlock(block, retry = false, key = KEY) {
    const username = block.dataset.username;
    const oneWeekAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
    const friendUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&limit=1&extended=1&from=${oneWeekAgo}&user=${username}&api_key=${key}&format=json`;
    const newBlock = block.cloneNode(true);
    try {
        const response = await fetch(friendUrl);
        updateProgress();
        if (!response.ok) {
            const errorData = await response.json();
            throw {
                status: response.status,
                data: errorData
            };
        }
        const data = await response.json();
        if (data.error) {
            throw {
                status: response.status,
                data: data
            };
        }
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

        if (trimmedName != oldName) {
            newBlock.dataset.previewTime = 0;
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
                gtag('event', 'exception', {
                    'description': 'rate_limit',
                    'fatal': false
                });
            }
        } else {
            console.error(`Error updating ${username}:`, error);
        }
    }
    newBlock.dataset.previewPlaying = block.dataset.previewPlaying || "false";

    return newBlock;
}

const blockContainer = document.getElementById("block-container");

// Update all blocks
async function updateAllBlocks() {
    const blocks = blockContainer.getElementsByClassName("block");
    const blocksArr = Array.from(blocks);

    completed = 0;

    const chunks = [];
    const newBlocks = [];

    chunks.push(blocksArr.slice(0, 250));
    const blockPromises = await Promise.all(chunks[0].map(block => updateBlock(block)));
    newBlocks.push(...blockPromises);

    // Update second chunk if necessary
    if (friendCount > 250) {
        await new Promise(resolve => setTimeout(resolve, 8000));
        chunks.push(blocksArr.slice(250, 500));
        const blockPromises = await Promise.all(chunks[1].map(block => updateBlock(block, false, KEY2)));
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
            newerBlocks.push(newBlock);
        }
    });

    // Call sortBlocks after all updates are done
    sortBlocks(newerBlocks);

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
        const duration = blocksIntervalTime;

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

    lastBlocksUpdate = Date.now();

    // Cache blocks, ticker, charts
    try {
        localStorage.setItem(blocksCacheKey, blockContainer.innerHTML);
    } catch (e) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
            console.warn('LocalStorage quota exceeded. Clearing storage...');
            
            const scheduleData = localStorage.getItem(scheduleCacheKey);
            const friendsData = localStorage.getItem(friendsCacheKey);
            const tickerData = localStorage.getItem(tickerCacheKey);

            localStorage.clear();

            localStorage.setItem(scheduleCacheKey, scheduleData);
            localStorage.setItem(friendsCacheKey, friendsData);
            localStorage.setItem(tickerCacheKey, tickerData);
            localStorage.setItem(blocksCacheKey, blockContainer.innerHTML);
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
        localStorage.setItem(tickerCacheKey, JSON.stringify(tickerData));
    } catch (e) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
            console.warn('LocalStorage quota exceeded. Clearing storage...');
            
            const scheduleData = localStorage.getItem(scheduleCacheKey);
            const friendsData = localStorage.getItem(friendsCacheKey);
            const blocksData = localStorage.getItem(blocksCacheKey);

            localStorage.clear();

            localStorage.setItem(scheduleCacheKey, scheduleData);
            localStorage.setItem(friendsCacheKey, friendsData);
            localStorage.setItem(tickerCacheKey, JSON.stringify(tickerData));
            localStorage.setItem(blocksCacheKey, blocksData);
            localStorage.setItem("visited", true);
        }
    }

    console.log(`Refreshed ${friendCount + 1} users!`);
}

// Sort blocks then replace old ones
function sortBlocks(blocks) {
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

    const container = document.getElementById("block-container");
    container.innerHTML = "";
    blocks.forEach(block => {
        container.appendChild(block);
    });
}

let friendCount = 0;

document.title = `${getUsernameFromURL()} | lastfmfriends.live`;

let friendsCacheKey;
let blocksCacheKey;
let tickerCacheKey;
let scheduleCacheKey;
let foundBlocksCache = false;
let foundTickerCache = false;

let KEY;
let KEY2;

// Get API key from backend
async function getKey(secondary = false) {
    let cachedKey;
    if (!secondary) {
        cachedKey = sessionStorage.getItem("lfl_key");
    } else {
        cachedKey = sessionStorage.getItem("lfl_key2"); 
    }
    if (cachedKey) {
        return cachedKey;
    }
    const response = await fetch("https://api-fetch.ctalbot4.workers.dev/");
    const data = await response.json();
    if (!secondary) {
        sessionStorage.setItem("lfl_key", data.key);
    } else {
        sessionStorage.setItem("lfl_key2", data.key);
    }
    return data.key;
}

// Initial fetch on load
async function initialFetch() {
    KEY = await getKey();

    const friendsUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getfriends&user=${getUsernameFromURL()}&limit=500&api_key=${KEY}&format=json`;
    const userUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=${getUsernameFromURL()}&api_key=${KEY}&format=json`;
    try {
        // Fetch user data
        const userResponse = await fetch(userUrl);
        if (!userResponse.ok) throw new Error("Network error");

        const userData = await userResponse.json();
        const user = userData.user;

        document.title = `${user.name} | lastfmfriends.live`;

        friendsCacheKey = `lfl_friends_${user.name}`;
        blocksCacheKey = `lfl_blocks_${user.name}`;
        tickerCacheKey = `lfl_ticker_${user.name}`;
        scheduleCacheKey = `lfl_schedule_${user.name}`;


        gtag('event', 'page_view', {
            'page_title': document.title,
            'page_location': window.location.href,
            'page_path': window.location.pathname
        });

        blockContainer.appendChild(createBlock(user));

        // Fetch friends data
        const friendsResponse = await fetch(friendsUrl);
        if (!friendsResponse.ok) throw new Error("Network error");

        const friendsData = await friendsResponse.json();
        friendCount = Math.min(parseInt(friendsData.friends["@attr"].total, 10), parseInt(friendsData.friends["@attr"].perPage, 10));
        const friends = friendsData.friends.user;

        // Set conservative refreshes to try to avoid API rate limit
        blocksIntervalTime = Math.max(10000, (friendCount / 5) * 1500);
        tickerIntervalTime = Math.max(270000, (friendCount / 5) * 9 * 3000);

        // Get secondary key if necessary
        if (friendCount > 250) {
            KEY2 = await getKey(true);
        }

        const cachedFriends = localStorage.getItem(friendsCacheKey);

        if (cachedFriends) {
            const parsedFriends = JSON.parse(cachedFriends);
            if (JSON.stringify(friends) === JSON.stringify(parsedFriends)) {
                const cachedSchedule = localStorage.getItem(scheduleCacheKey);
                if (cachedSchedule) {
                    const {
                        blocks,
                        ticker
                    } = JSON.parse(cachedSchedule);
                    lastBlocksUpdate = blocks;
                    lastTickerUpdate = ticker;

                    const now = Date.now();

                    // Calculate time when the next update should occur
                    let nextBlockUpdateTime = lastBlocksUpdate + blocksIntervalTime;
                    let blocksDelay = nextBlockUpdateTime - now;

                    if (blocksDelay > 0) {
                        const cachedBlocks = localStorage.getItem(blocksCacheKey);
                        blockContainer.innerHTML = cachedBlocks;
                        console.log("Loaded blocks from cache.");
                        foundBlocksCache = true;
                    }

                    let nextTickerUpdateTime = lastTickerUpdate + tickerIntervalTime;
                    let tickerDelay = nextTickerUpdateTime - now;

                    if (tickerDelay > 0) {
                        const tickerCache = JSON.parse(localStorage.getItem(tickerCacheKey));
                        const ticker = tickerCache?.ticker || '';
                        const charts = tickerCache?.charts || '';
                        const tickerDiv = document.querySelector(".ticker-stats");
                        const scrollDiv = document.querySelector(".ticker-scroll");
                        const chartsDiv = document.querySelector(".charts-scrollable");

                        tickerDiv.innerHTML = ticker;
                        scrollDiv.innerHTML = ticker;
                        chartsDiv.innerHTML = charts;

                        foundTickerCache = true;
                        console.log("Loaded ticker from cache.");
                    }
                }

            }
        }
        try {
            localStorage.setItem(friendsCacheKey, JSON.stringify(friends));
        } catch (e) {
            if (e instanceof DOMException && e.name === 'QuotaExceededError') {
                console.warn('LocalStorage quota exceeded. Clearing storage...');
            
                const scheduleData = localStorage.getItem(scheduleCacheKey);
                const tickerData = localStorage.getItem(tickerCacheKey);
                const blocksData = localStorage.getItem(blocksCacheKey);

                localStorage.clear();

                localStorage.setItem(scheduleCacheKey, scheduleData);
                localStorage.setItem(friendsCacheKey, JSON.stringify(friends));
                localStorage.setItem(tickerCacheKey, tickerData);
                localStorage.setItem(blocksCacheKey, blocksData);
                localStorage.setItem("visited", true);
            }
        }

        if (!foundBlocksCache) {
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

const initialPromise = initialFetch();

// Call updateAllBlocks after both fetches have completed
Promise.allSettled([initialPromise])
    .then(async () => {
        await Promise.all([
            foundTickerCache ? null : updateTicker(),
            foundBlocksCache ? null : updateAllBlocks()
        ].filter(Boolean));

        rows = organizeBlocksIntoRows();

        document.getElementById("block-container").classList.remove("hidden");
        document.getElementById("mobile-toggle").classList.remove("removed");
        document.getElementById("stats-ticker").classList.remove("hidden");
        document.getElementById("progress-container").classList.add("removed");

        scheduleUpdates();

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

let lastBlocksUpdate;
let blocksIntervalTime;
let blocksTimeout;

let lastTickerUpdate;
let tickerIntervalTime;
let tickerTimeout;

// Schedule next ticker and block update
async function scheduleUpdates() {
    // Cancel other timeouts because this will replace them
    cancelUpdates();

    const now = Date.now();

    // Calculate time when the next update should occur
    let nextBlockUpdateTime = lastBlocksUpdate + blocksIntervalTime;
    let blocksDelay = nextBlockUpdateTime - now;

    if (blocksDelay <= 0) {
        await updateAllBlocks();

        // Schedule next update
        blocksTimeout = setTimeout(scheduleUpdates, blocksIntervalTime);
    } else {
        blocksTimeout = setTimeout(scheduleUpdates, blocksDelay);
    }

    let nextTickerUpdateTime = lastTickerUpdate + tickerIntervalTime;
    let tickerDelay = nextTickerUpdateTime - now;

    if (tickerDelay <= 0) {
        await updateTicker();

        // Schedule next update
        tickerTimeout = setTimeout(scheduleUpdates, tickerIntervalTime);
    } else {
        tickerTimeout = setTimeout(scheduleUpdates, tickerDelay);
    }

    const scheduleData = {
        blocks: lastBlocksUpdate,
        ticker: lastTickerUpdate
    }
    localStorage.setItem(scheduleCacheKey, JSON.stringify(scheduleData));
}

function cancelUpdates() {
    clearTimeout(blocksTimeout);
    clearTimeout(tickerTimeout);
}

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        scheduleUpdates();
    } else {
        cancelUpdates();
    }
});

window.addEventListener("hashchange", function() {
    location.reload();
});

// Google analytics events
document.body.addEventListener("click", function(event) {
    let target = event.target;

    // Track clicks in charts
    if (target.closest("#artists-list") && target.closest("a")) {
        gtag("event", "chart_click", {
            click_type: "artists",
            artist_target: target.textContent,
        });
    } else if (target.closest("#albums-list") && target.closest("a")) {
        gtag("event", "chart_click", {
            click_type: "albums",
            album_target: target.textContent,
        });
    } else if (target.closest("#tracks-list") && target.closest("a")) {
        gtag("event", "chart_click", {
            click_type: "tracks",
            track_target: target.textContent,
        });
    }

    // Track clicks in block-container
    if (target.closest("#block-container")) {
        if (target.closest(".artist-title")) {
            gtag("event", "block_click", {
                click_type: "artist",
                artist_target: target.textContent,
            });
        } else if (target.closest(".song-title")) {
            gtag("event", "block_click", {
                click_type: "track",
                track_target: target.textContent,
            });
        } else if (target.closest(".user-info")) {
            gtag("event", "block_click", {
                click_type: "username",
                user_target: target.textContent,
            });
        }
    }

    // Track clicks in ticker
    if (target.closest(".ticker-main")) {
        if (target.closest(".ticker-artist") && target.closest("a")) {
            gtag("event", "ticker_click", {
                click_type: "artist",
                artist_target: target.textContent,
            });
        } else if (target.closest(".ticker-album") && target.closest("a")) {
            gtag("event", "ticker_click", {
                click_type: "album",
                album_target: target.textContent,
            });
        } else if (target.closest(".ticker-track") && target.closest("a")) {
            gtag("event", "ticker_click", {
                click_type: "track",
                track_target: target.textContent,
            });
        }
    }
});