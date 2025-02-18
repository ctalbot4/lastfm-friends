const APIKEY = "1c4a67a2eacf14e735edb9e4475d3237";

function getUsernameFromURL() {
    const hash = window.location.hash; 
    const username = hash.substring(1);
    return username;
}

const progressBar = document.getElementById("progress-bar");

function updateProgress() {
    completed++;
    const progress = (completed / ((friendCount + 1) * 4)) * 100;
    progressBar.style.width = progress + "%";
}

// Create a block with user info
function createBlock(user) {
    const username = user.name;
    const userUrl = user.url
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
async function updateBlock(block) {
    const username = block.dataset.username;
    const oneWeekAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
    const friendUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&limit=1&from=${oneWeekAgo}&user=${username}&api_key=${APIKEY}&format=json`;
    const newBlock = block.cloneNode(true);
    try {
        const response = await fetch(friendUrl);
        updateProgress();
        if (!response.ok) {
            throw new Error("Network error");
        }
        const data = await response.json();
        if (data.recenttracks["@attr"]["total"] == 0) {
            newBlock.classList.add("removed");
            return newBlock;
        }
        else {
            newBlock.classList.remove("removed");
        }
        userPlayCounts[username] = parseInt(data.recenttracks["@attr"].total);

        const recentTrack = data.recenttracks.track[0];
        const songLink = recentTrack.url;
        const artistLink = songLink.split("/_")[0];
        newBlock.querySelector(".bottom > .track-info > .song-title > a").innerText = recentTrack.name;
        newBlock.querySelector(".bottom > .track-info > .artist-title > a").innerText = recentTrack.artist["#text"];
        newBlock.querySelector(".bottom > .track-info > .song-title > a").setAttribute('href', songLink);
        newBlock.querySelector(".bottom > .track-info > .artist-title > a").setAttribute('href', artistLink);

        const imageUrl = recentTrack.image[3]["#text"];
        newBlock.style.backgroundImage = `url(${imageUrl})`;

        const nowPlaying = recentTrack["@attr"]?.nowplaying;
        const timeSpan = newBlock.querySelector(".time");
        
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
    } catch (error) {
        newBlock.classList.add("removed");
        console.error("Error updating block:", error);
    }
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

    // Call sortBlocks after all updates are done
    sortBlocks(newBlocks);

    // Update now playing count
    const nowPlayingCount = document.querySelectorAll('.block[data-now-playing="true"]').length;
    const nowPlayingElements = document.querySelectorAll('.ticker-friends > .value');
    nowPlayingElements.forEach(element => {
        element.textContent = `${nowPlayingCount} friend${nowPlayingCount !== 1 ? 's' : ''}`;
    });

    // Update total plays
    const totalPlays = Object.values(userPlayCounts).reduce((sum, count) => sum + count, 0);
    document.querySelectorAll(".ticker-plays > .value").forEach(element => {
        element.innerText = totalPlays;
    });

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
                    if (artistPlays[artist.name]) {
                        artistPlays[artist.name] += parseInt(artist.playcount);
                    } 
                    else {
                        artistPlays[artist.name] = parseInt(artist.playcount);
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
                    if (albumPlays[album.name]) {
                        albumPlays[album.name] += parseInt(album.playcount);
                    } 
                    else {
                        albumPlays[album.name] = parseInt(album.playcount);
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
                    if (trackPlays[track.name]) {
                        trackPlays[track.name] += parseInt(track.playcount);
                    } 
                    else {
                        trackPlays[track.name] = parseInt(track.playcount);
                    }                
                });
                updateProgress();
            })
            .catch((error) => {
                console.error("Error fetching user track data:", error);
            });
    });

    await Promise.all([...artistPromises, ...albumPromises, ...trackPromises]);
    const sortedArtistPlays = Object.entries(artistPlays).sort((a, b) => b[1] - a[1]);
    const sortedAlbumPlays = Object.entries(albumPlays).sort((a, b) => b[1] - a[1]);
    const sortedTrackPlays = Object.entries(trackPlays).sort((a, b) => b[1] - a[1]);
    document.querySelectorAll(".ticker-artist > .value").forEach(element => {
        element.innerText = sortedArtistPlays[0][0];
    });
    document.querySelectorAll(".ticker-artist > .subtext").forEach(element => {
        element.innerText = `(${sortedArtistPlays[0][1]} plays)`;
    });
    
    document.querySelectorAll(".ticker-album > .value").forEach(element => {
        element.innerText = sortedAlbumPlays[0][0];
    });
    document.querySelectorAll(".ticker-album > .subtext").forEach(element => {
        element.innerText = `(${sortedAlbumPlays[0][1]} plays)`;
    });
    document.querySelectorAll(".ticker-track > .value").forEach(element => {
        element.innerText = sortedTrackPlays[0][0];
    });
    document.querySelectorAll(".ticker-track> .subtext").forEach(element => {
        element.innerText = `(${sortedTrackPlays[0][1]} plays)`;
    });

    console.log("Stats refreshed!");
}

const friendsUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getfriends&user=${getUsernameFromURL()}&limit=150&api_key=${APIKEY}&format=json`;
const userUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=${getUsernameFromURL()}&api_key=${APIKEY}&format=json`;

let friendCount = 0;

document.title = `${getUsernameFromURL()} | Last.fm Friends`;

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
        document.title = `${user.name} | Last.fm Friends`;
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
        setInterval(updateTicker, Math.max(90000, (friendCount / 45) * 1000));
    });

window.addEventListener("hashchange", function() {
    location.reload();
});