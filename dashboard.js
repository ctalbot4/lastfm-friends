const APIKEY = "1c4a67a2eacf14e735edb9e4475d3237";

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
                    <a href="" target="_blank"></a>
                    <svg class="heart-icon" viewBox="0 0 120 120" fill="white">
                    <path class="st0" d="M60.83,17.19C68.84,8.84,74.45,1.62,86.79,0.21c23.17-2.66,44.48,21.06,32.78,44.41 c-3.33,6.65-10.11,14.56-17.61,22.32c-8.23,8.52-17.34,16.87-23.72,23.2l-17.4,17.26L46.46,93.56C29.16,76.9,0.95,55.93,0.02,29.95 C-0.63,11.75,13.73,0.09,30.25,0.3C45.01,0.5,51.22,7.84,60.83,17.19L60.83,17.19L60.83,17.19z"/>
                    </svg>
                </div>
                <div class="artist-title">
                    <a href="" target="_blank"></a>
                </div>
            </div>
            <div class="status">     
                <span class="time"></span>               
                <img src="https://www.last.fm/static/images/icons/now_playing_grey_12@2x.a643c755e003.gif" class="playing-icon">
            </div>
        </div>
    `;
    blockDiv.innerHTML = blockHTML;
    return blockDiv;
}

let completed = 0;
const userPlayCounts = {};

// Fetch data for a block and update
async function updateBlock(block, retry = false) {
    const username = block.dataset.username;
    const oneWeekAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
    const friendUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&limit=1&extended=1&from=${oneWeekAgo}&user=${username}&api_key=${APIKEY}&format=json`;
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
        }
        else {
            newBlock.classList.remove("removed");
        }
        userPlayCounts[username] = parseInt(data.recenttracks["@attr"].total);

        const recentTrack = data.recenttracks.track[0];
        const songLink = recentTrack.url;
        const artistLink = songLink.split("/_")[0];
        newBlock.querySelector(".bottom > .track-info > .song-title > a").innerText = recentTrack.name;
        newBlock.querySelector(".bottom > .track-info > .artist-title > a").innerText = recentTrack.artist.name;
        newBlock.querySelector(".bottom > .track-info > .song-title > a").href = songLink;
        newBlock.querySelector(".bottom > .track-info > .artist-title > a").href = artistLink;

        const imageUrl = recentTrack.image[3]["#text"];
        newBlock.style.backgroundImage = `url(${imageUrl})`;

        const nowPlaying = recentTrack["@attr"]?.nowplaying;
        const timeSpan = newBlock.querySelector(".time");

        if (recentTrack.loved === "0") {
            newBlock.querySelector(".heart-icon").classList.add("removed");
        }
        else {
            newBlock.querySelector(".heart-icon").classList.remove("removed");
        }
        
        if (nowPlaying) {
            newBlock.dataset.nowPlaying = "true";
            newBlock.dataset.date = Math.floor(Date.now() / 1000);
        } 
        else {
            newBlock.dataset.nowPlaying = "false";
            newBlock.dataset.date = recentTrack.date.uts;
            const diff = Math.floor((Date.now() - (newBlock.dataset.date * 1000)) / 1000);

            if (diff < 60) {
                timeSpan.innerText = "Just now";
            } 
            else if (diff < 60 * 60) {
                const minutes = Math.floor(diff / 60);
                timeSpan.innerText = `${minutes}m ago`;
            } 
            else if (diff < 60 * 60 * 24) {
                const hours = Math.floor(diff / (60 * 60));
                timeSpan.innerText = `${hours}h ago`;
            } 
            else if (diff < 60 * 60 * 24 * 365) {
                const days = Math.floor(diff / (60 * 60 * 24));
                timeSpan.innerText = `${days}d ago`;
            }
            else {
                const years = Math.floor(diff / (60 * 60 * 24 * 365));
                timeSpan.innerText = `${years}y ago`;
            }
        }
    } 
    catch (error) {
        newBlock.classList.add("removed");

        if (error.data) {
            console.error(`API error ${error.data.error} for user ${username}:`, error.data.message);
            if (error.data?.error === 17) {
                // Remove if private user
                return null;
            }
            else if (error.data?.error === 8 && retry == false) {
                return updateBlock(block, true);
            }
        }
        else {
            console.error(`Error updating ${username}:`, error);
        }
    }
    newBlock.dataset.previewPlaying = block.dataset.previewPlaying || "false";

    return newBlock;
}

// Update all blocks
async function updateAllBlocks() {
    const blocks = document.getElementById("block-container").getElementsByClassName("block");

    completed = 0;

    // Convert blocks to an array and map each block to an updateBlock call
    const updatePromises = Array.from(blocks).map(block => updateBlock(block));

    // Wait for all updateBlock calls to complete
    const newBlocks = await Promise.all(updatePromises);

    const newerBlocks = [];

    // Sync previewPlaying from original blocks and ignore null blocks
    newBlocks.forEach((newBlock, index) => {
        if (newBlock) {
            const originalBlock = blocks[index];
            newBlock.dataset.previewPlaying = originalBlock.dataset.previewPlaying || "false";
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
    
    // Counting animation
    const startPlays = parseInt(document.querySelector(".ticker-plays > .value").innerText);
    if (startPlays) {
        let startTime = null;
        const duration = Math.max(10000, (friendCount / 5) * 1000) - 2000;

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
    }
    else {
        document.querySelectorAll(".ticker-plays > .value").forEach(element => {
            element.innerText = totalPlays;
        });
    }
    
    console.log(`Refreshed ${friendCount + 1} users!`);
}

// Sort blocks then replace old ones
function sortBlocks (blocks) {
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
        }
        else if (yUsername === username && yNowPlaying) {
            return 1;
        }
        else if (xNowPlaying && !yNowPlaying) {
            return -1;
        }
        else if (!xNowPlaying && yNowPlaying) {
            return 1;
        }
        else if (xNowPlaying && yNowPlaying) {
            return xUsername.localeCompare(yUsername);
        }
        else {
            return yDate - xDate; 
        }
    });

    const container = document.getElementById("block-container");
    container.innerHTML = "";
    blocks.forEach(block => {
        container.appendChild(block);});
}

// Update ticker (other than now playing, plays)
async function updateTicker() {

    const artistPlays = {};
    const albumPlays = {};
    const trackPlays = {};
    const blocks = document.getElementById("block-container").getElementsByClassName("block");

    const artistPromises = Array.from(blocks).map(block => {
        const username = block.dataset.username;
        artistsUrl = `https://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=${username}&limit=100&period=7day&api_key=${APIKEY}&format=json`;
        return fetch(artistsUrl)
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Network error");
                }
                return response.json();
            })
            .then((data) => {
                data.topartists.artist.forEach(artist => {
                    const count = parseInt(artist.playcount);
                    const url = artist.url;
                    if (artistPlays[artist.name]) {
                        artistPlays[artist.name].count += count;
                    } 
                    else {
                        artistPlays[artist.name] = {
                            count,
                            url
                        };
                    }               
                });
                updateProgress();
            })
            .catch((error) => {
                console.error("Error fetching user artist data:", error);
            });
    });

    const albumPromises = Array.from(blocks).map(block => {
        const username = block.dataset.username;
        albumsUrl = `https://ws.audioscrobbler.com/2.0/?method=user.gettopalbums&user=${username}&limit=100&period=7day&api_key=${APIKEY}&format=json`;
        return fetch(albumsUrl)
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Network error");
                }
                return response.json();
            })
            .then((data) => {
                data.topalbums.album.forEach(album => {
                    const count = parseInt(album.playcount);
                    const url = album.url;
                    if (albumPlays[album.name]) {
                        albumPlays[album.name].count += count;
                    } 
                    else {
                        albumPlays[album.name] = {
                            count,
                            url
                        };
                    }                
                });
                updateProgress();
            })
            .catch((error) => {
                console.error("Error fetching user album data:", error);
            });
    });

    const trackPromises = Array.from(blocks).map(block => {
        const username = block.dataset.username;
        tracksUrl = `https://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&user=${username}&limit=100&period=7day&api_key=${APIKEY}&format=json`;
        return fetch(tracksUrl)
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Network error");
                }
                return response.json();
            })
            .then((data) => {
                data.toptracks.track.forEach(track => {
                    const count = parseInt(track.playcount);
                    const url = track.url;
                    if (trackPlays[track.name]) {
                        trackPlays[track.name].count += count;
                    } 
                    else {
                        trackPlays[track.name] = {
                            count,
                            url
                        };
                    }               
                });
                updateProgress();
            })
            .catch((error) => {
                console.error("Error fetching user track data:", error);
            });
    });

    await Promise.all([...artistPromises, ...albumPromises, ...trackPromises]);
    const sortedArtistPlays = Object.entries(artistPlays).sort((a, b) => b[1].count - a[1].count);
    const sortedAlbumPlays = Object.entries(albumPlays).sort((a, b) => b[1].count - a[1].count);
    const sortedTrackPlays = Object.entries(trackPlays).sort((a, b) => b[1].count - a[1].count);

    document.querySelectorAll(".ticker-artist > .value > a").forEach(element => {
        element.innerText = sortedArtistPlays[0][0];
    });
    document.querySelectorAll(".ticker-artist > .subtext").forEach(element => {
        element.innerText = `(${sortedArtistPlays[0][1].count} plays)`;
    });
    document.querySelectorAll(".ticker-artist > .value > a").forEach(element => {
        element.href = sortedArtistPlays[0][1].url;
    });
    
    document.querySelectorAll(".ticker-album > .value > a").forEach(element => {
        element.innerText = sortedAlbumPlays[0][0];
    });
    document.querySelectorAll(".ticker-album > .subtext").forEach(element => {
        element.innerText = `(${sortedAlbumPlays[0][1].count} plays)`;
    });
    document.querySelectorAll(".ticker-album > .value > a").forEach(element => {
        element.href = sortedAlbumPlays[0][1].url;
    });

    document.querySelectorAll(".ticker-track > .value > a").forEach(element => {
        element.innerText = sortedTrackPlays[0][0];
    });
    document.querySelectorAll(".ticker-track> .subtext").forEach(element => {
        element.innerText = `(${sortedTrackPlays[0][1].count} plays)`;
    });
    document.querySelectorAll(".ticker-track > .value > a").forEach(element => {
        element.href = sortedTrackPlays[0][1].url;
    });

    console.log("Stats refreshed!");
}

const friendsUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getfriends&user=${getUsernameFromURL()}&limit=150&api_key=${APIKEY}&format=json`;
const userUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=${getUsernameFromURL()}&api_key=${APIKEY}&format=json`;

let friendCount = 0;

document.title = `${getUsernameFromURL()} | lastfmfriends.live`;

// Fetch user data
const userFetch = fetch(userUrl)
    .then((response) => {
        if (!response.ok) {
            throw new Error("Network error");
        }
        return response.json();
    })
    .then((data) => {
        const user = data.user;
        document.title = `${user.name} | lastfmfriends.live`;
        gtag('event', 'page_view', {
            'page_title': document.title,
            'page_location': window.location.href,
            'page_path': window.location.pathname
          });

        const blockContainer = document.getElementById("block-container");
        blockContainer.appendChild(createBlock(user));
    })
    .catch((error) => {
        console.error("Error fetching user data:", error);
        document.getElementById("error-popup").classList.remove("removed");
    });

// Fetch friends data
const friendsFetch = fetch(friendsUrl)
    .then((response) => {
        if (!response.ok) {
            throw new Error("Network error");
        }
        return response.json();
    })
    .then((data) => {
        friendCount = Math.min(parseInt(data.friends["@attr"].total, 10), parseInt(data.friends["@attr"].perPage, 10));
        const friends = data.friends.user;
        const blockContainer = document.getElementById("block-container");
        friends.forEach((friend) => {
            blockContainer.appendChild(createBlock(friend));
        });
    })
    .catch((error) => {
        console.error("Error fetching friends data:", error);
        document.getElementById("error-popup").classList.remove("removed");
    });

// Call updateAllBlocks after both fetches have completed
Promise.allSettled([userFetch, friendsFetch])
    .then(async () => {
        await Promise.all([updateTicker(), updateAllBlocks()]);

        document.getElementById("block-container").classList.remove("hidden");
        document.getElementById("stats-ticker").classList.remove("hidden");
        document.getElementById("progress-container").classList.add("removed");

        // Set conservative refreshes to try to avoid API rate limit
        setInterval(updateAllBlocks, Math.max(10000, (friendCount / 5) * 1000));
        setInterval(updateTicker, Math.max(90000, (friendCount / 5) * 9 * 1000));
    });

window.addEventListener("hashchange", function() {
    location.reload();
});

// HOVER PLAY

let currentAudio = null;
let currentBlock = null;
let activeRequestId = 0;

// Store timers across block clones
const hoverTimers = {};
const previewTimers = {};

// JSONP helper
function getJSONP(url, callback) {
    const callbackName = "jsonp_callback_" + Math.round(100000 * Math.random());
    const requestId = activeRequestId;
    
    window[callbackName] = function(data) {      
        // Return if stale request  
        if (requestId !== activeRequestId) {
            delete window[callbackName];
            document.body.removeChild(script);
            return;
        }
    
        callback(data);
        delete window[callbackName];
        document.body.removeChild(script);
    };
  
    const script = document.createElement("script");
    script.src = url + (url.indexOf('?') >= 0 ? "&" : "?") + "callback=" + callbackName;
    document.body.appendChild(script);
}

// Search for preview and retry if not found
function searchPreview(trackTitle, artistName, block, retried = false) {
    // Remove any question marks (causes issues with Deezer API)
    const sanitizedTrackTitle = trackTitle.replace(/\?/g, '');

    const query = `artist:"${artistName}" track:"${sanitizedTrackTitle}"`;
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.deezer.com/search/track/?q=${encodedQuery}&output=jsonp`;
  
    getJSONP(url, function(result) {
        // Find first fesult that contains matching word in artist and song name
        const trackWords = trackTitle.toLowerCase().split(/\s+/);
        const artistWords = artistName.toLowerCase().split(/\s+/);
        let foundTrack = null;
        for (let track of result.data) {
            const resultTrackTitle = track.title.toLowerCase();
            const resultArtistName = track.artist.name.toLowerCase();
            const trackMatches = trackWords.some(word => resultTrackTitle.includes(word));
            const artistMatches = artistWords.some(word => resultArtistName.includes(word));

            if (trackMatches && artistMatches) {
                foundTrack = track;
                break;
            }
        }
        
        if (foundTrack && foundTrack.preview) {
            currentAudio = new Audio(foundTrack.preview);
            currentAudio.play();
            document.getElementById("block-container").querySelector(`[data-username="${block.dataset.username}"]`).dataset.previewPlaying = "true";
            previewTimers[block.dataset.username] = setTimeout(() => {
                document.getElementById("block-container").querySelector(`[data-username="${block.dataset.username}"]`).dataset.previewPlaying = "false";
            }, 30000);
        }
        else if (!retried && trackTitle.includes('(')) {
            const newTitle = trackTitle.replace(/\(.*?\)/g, '').trim();
            console.log(`Retrying search without parentheses: "${newTitle}"`);
            searchPreview(newTitle, artistName, block, true);
        }
        else {
            console.log(`No preview found for "${trackTitle}" by "${artistName}"`);
        }
    });
  }

const blockContainer = document.getElementById("block-container");

blockContainer.addEventListener("mouseover", function(e) {
    if (!isSoundOn) return;
    const block = e.target.closest(".block");
    if (!block) return;

    // If same track, don't restart
    if (currentBlock && currentBlock.querySelector('.song-title a')?.textContent.trim() == block.querySelector('.song-title a')?.textContent.trim() &&
        currentBlock.querySelector('.artist-title a')?.textContent.trim() == block.querySelector('.artist-title a')?.textContent.trim()) {
            return;
    }
    
    // Clear previous timeout on hovered block
    if (hoverTimers[block.dataset.username] || previewTimers[block.dataset.username]) {
        clearTimeout(hoverTimers[block.dataset.username]);
        clearTimeout(previewTimers[block.dataset.username]);
    }

    // Clear previous timeout on previous block if mouseout wasn't triggered
    if (currentBlock) {
        document.getElementById("block-container").querySelector(`[data-username="${currentBlock.dataset.username}"]`).dataset.previewPlaying = "false";
        clearTimeout(hoverTimers[currentBlock.dataset.username]);
        clearTimeout(previewTimers[currentBlock.dataset.username]);
    }
        
    // Cancel previous interactions
    activeRequestId++;
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
  
    currentBlock = block;

    // Wait for 200 ms then start song search
    hoverTimers[block.dataset.username] = setTimeout(() => {
        const trackTitle = block.querySelector('.song-title a').textContent;
        const artistName = block.querySelector('.artist-title a').textContent;

        searchPreview(trackTitle, artistName, block);
    }, 200);
});

// Stop when mouse leaves the block
blockContainer.addEventListener("mouseout", function(e) {
    const block = e.target.closest(".block");
    if (!block || e.relatedTarget?.closest('.block') === block) return;

    // Clear any previous timeout
    if (hoverTimers[block.dataset.username] || previewTimers[block.dataset.username]) {
        clearTimeout(hoverTimers[block.dataset.username]);
        clearTimeout(previewTimers[block.dataset.username]);
    }

    // Cancel 
    activeRequestId++;
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
    document.getElementById("block-container").querySelector(`[data-username="${block.dataset.username}"]`).dataset.previewPlaying = "false";
    currentBlock = null;
});

// Sound toggle
let isSoundOn = false;
const soundToggle = document.getElementById('sound-toggle');

soundToggle.addEventListener('click', () => {
    isSoundOn = !isSoundOn;
    soundToggle.classList.toggle('muted', !isSoundOn);
});