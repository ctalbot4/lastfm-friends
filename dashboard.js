function getUsernameFromURL() {
    const hash = window.location.hash; 
    const username = hash.substring(1);
    return username;
}

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
                <img id="pfp" src="${imageUrl || 'https://lastfm.freetls.fastly.net/i/u/avatar170s/818148bf682d429dc215c1705eb27b98.png'}">
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

async function updateBlock(block) {
    const username = block.dataset.username;
    const friendUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&limit=1&user=${username}&api_key=1c4a67a2eacf14e735edb9e4475d3237&format=json`;
    const newBlock = block.cloneNode(true);
    try {
        const response = await fetch(friendUrl);
        if (!response.ok) {
            throw new Error("Network error");
        }

        const data = await response.json();
        if (data.recenttracks["@attr"]["total"] == 0) {
            newBlock.classList.add("hidden");
            return newBlock;
        }
        else {
            newBlock.classList.remove("hidden");
        }
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
        newBlock.classList.add("hidden");
        console.error("Error updating block:", error);
    }
    return newBlock;
}

async function updateAllBlocks() {
    const blocks = document.getElementById("block-container").getElementsByClassName("block");

    // Convert blocks to an array and map each block to an updateBlock call
    const updatePromises = Array.from(blocks).map(block => updateBlock(block));

    // Wait for all updateBlock calls to complete
    const newBlocks = await Promise.all(updatePromises);

    // Call sortBlocks after all updates are done
    sortBlocks(newBlocks);
    console.log("Refreshed!");
}

// Sort blocks then replace old ones
function sortBlocks (blocks) {
    const username = getUsernameFromURL();
    blocks.sort((x, y) => {
        if (x.dataset.username == username && x.dataset.nowPlaying == "true") {
            return -1;
        }
        else if (y.dataset.username == username && y.dataset.nowPlaying == "true") {
            return 1;
        }
        else if (x.dataset.nowPlaying == "true" && y.dataset.nowPlaying == "false") {
            return -1;
        }
        else if (x.dataset.nowPlaying == "false" && y.dataset.nowPlaying == "true") {
            return 1;
        }
        else if (x.dataset.nowPlaying == "true" && y.dataset.nowPlaying == "true") {
            return x.dataset.username.localeCompare(y.dataset.username);
        }
        else if (x.dataset.date > y.dataset.date) {
            return -1;
        }
        else {
            return 1;
        }
    });

    const container = document.getElementById("block-container");
    container.innerHTML = "";
    blocks.forEach(block => {
        container.appendChild(block);});
}

const friendsUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getfriends&user=${getUsernameFromURL()}&limit=200&api_key=1c4a67a2eacf14e735edb9e4475d3237&format=json`;
const userUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=${getUsernameFromURL()}&api_key=1c4a67a2eacf14e735edb9e4475d3237&format=json`;

let friendCount = 0;

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
        const blockContainer = document.getElementById("block-container");
        blockContainer.appendChild(createBlock(user));
    })
    .catch((error) => {
        console.error("Error fetching user data:", error);
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
        setInterval(updateAllBlocks, Math.max(10000, (friendCount / 5) * 1000));
    })
    .catch((error) => {
        console.error("Error fetching friends data:", error);
    });

// Call updateAllBlocks after both fetches have completed
Promise.allSettled([userFetch, friendsFetch])
    .then(() => {
        updateAllBlocks();
    });

window.addEventListener("hashchange", function() {
    location.reload();
});