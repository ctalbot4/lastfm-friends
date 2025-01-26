// Function to get the username from the URL
function getUsernameFromURL() {
    const hash = window.location.hash; 
    const username = hash.substring(1);
    // const username = "ctalbot4_2"
    return username;
}

function createBlock(username, imageUrl) {
    const blockDiv = document.createElement("div");
    blockDiv.className = "block";
    blockDiv.setAttribute("data-username", username);

    const blockHTML = `
        <div class="user-info">
            <div class="profile-picture">
                <img id="pfp" src="${imageUrl || 'https://lastfm.freetls.fastly.net/i/u/avatar170s/818148bf682d429dc215c1705eb27b98.png'}">
            </div>
            <div class="username">${username}</div>
        </div>
        <div class="bottom">
            <div class="song-info">
                <div class="song-title">
                    <span></span>
                </div>
                <div class="song-artist">
                    <span></span>
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
    const friendUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&limit=1&user=${username}&api_key=24e68c864088b9726a71eb31b4567cad&format=json`;

    try {
        const response = await fetch(friendUrl);
        if (!response.ok) {
            throw new Error("Network error");
        }

        const data = await response.json();
        const recentTrack = data.recenttracks.track[0];

        block.querySelector(".bottom > .song-info > .song-title > span").innerText = recentTrack.name;
        block.querySelector(".bottom > .song-info > .song-artist > span").innerText = recentTrack.artist["#text"];
        const imageUrl = recentTrack.image[3]["#text"];
        block.style.backgroundImage = `url(${imageUrl})`;

        const nowPlaying = recentTrack["@attr"]?.nowplaying;
        const timeSpan = block.querySelector(".time");
        
        if (nowPlaying) {
            block.dataset.nowPlaying = "true";
            block.dataset.date = Math.floor(Date.now() / 1000);
        } 
        else {
            block.dataset.nowPlaying = "false";
            block.dataset.date = recentTrack.date.uts;
            const diff = Math.floor((Date.now() - (block.dataset.date * 1000)) / 1000);

            if (diff < 60) {
                timeDiv.innerText = "Just now";
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
        console.error("Error updating block:", error);
    }
}

async function updateAllBlocks() {
    const blocks = document.getElementById("block-container").getElementsByClassName("block");

    // Convert blocks to an array and map each block to an updateBlock call
    const updatePromises = Array.from(blocks).map(block => updateBlock(block));

    // Wait for all updateBlock calls to complete
    await Promise.all(updatePromises);

    // Call sortBlocks after all updates are done
    sortBlocks();
    console.log("Refreshed!");
}


function sortBlocks () {
    const blocks = Array.from(document.getElementsByClassName("block"));
    blocks.sort((x, y) => {
        if (x.dataset.nowPlaying == "true" && y.dataset.nowPlaying == "false") {
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
    blocks.forEach(block => container.appendChild(block));
}

const apiUrl = "https://ws.audioscrobbler.com/2.0/?method=user.getfriends&user=" + getUsernameFromURL() + "&api_key=24e68c864088b9726a71eb31b4567cad&format=json";

// Fetch data from the Last.fm API
fetch(apiUrl)
    .then((response) => {
        if (!response.ok) {
            throw new Error("Network error");
        }
        return response.json();
    })
    .then((data) => {
        const friends = data.friends.user;

        const blockContainer = document.getElementById("block-container");

        friends.forEach((friend) => {
            const imageUrl = friend.image[3]["#text"];
            const blockDiv = blockContainer.appendChild(createBlock(friend.name, imageUrl));
        });
        updateAllBlocks();
    })
    .catch((error) => {
        console.error("Error fetching data:", error);
    });

window.addEventListener("hashchange", function() {
    location.reload();
});

// setInterval(updateAllBlocks, 10000);