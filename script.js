// Function to get the username from the URL
function getUsernameFromURL() {
    const hash = window.location.hash; 
    const username = hash.substring(1);
    return username;
}

function createBlock(username, imageUrl) {
    // Create the main block container
    const blockDiv = document.createElement("div");
    blockDiv.className = "block";
    blockDiv.setAttribute("data-username", username);
  
    // Create the user-info container
    const userInfoDiv = document.createElement("div");
    userInfoDiv.className = "user-info";
  
    // Create the profile picture container
    const profilePictureDiv = document.createElement("div");
    profilePictureDiv.className = "profile-picture";
  
    const img = document.createElement("img");
    img.id = "pfp";
    if (imageUrl == "") {
        img.src = "https://lastfm.freetls.fastly.net/i/u/avatar170s/818148bf682d429dc215c1705eb27b98.png";
    }
    else {
        img.src = imageUrl;
    }
    profilePictureDiv.appendChild(img);
  
    // Create the username container
    const usernameDiv = document.createElement("div");
    usernameDiv.className = "username";
    usernameDiv.innerHTML = username;
  
    // Append profile picture and username to user-info
    userInfoDiv.appendChild(profilePictureDiv);
    userInfoDiv.appendChild(usernameDiv);
  
    // Create the song-info container
    const songInfoDiv = document.createElement("div");
    songInfoDiv.className = "song-info";
  
    const songTitleDiv = document.createElement("div");
    songTitleDiv.className = "song-title";
    songTitleDiv.appendChild(document.createElement("span"));
  
    const songArtistDiv = document.createElement("div");
    songArtistDiv.className = "song-artist";
    songArtistDiv.appendChild(document.createElement("span"));

    // const nowPlayingDiv = document.createElement("div");
    // nowPlayingDiv.className = "nowPlaying";
    
    const nowPlayingIcon = document.createElement("img");
    nowPlayingIcon.src = "https://www.last.fm/static/images/icons/now_playing_grey_12@2x.a643c755e003.gif";
    nowPlayingIcon.className = "playing-icon"

    // nowPlayingDiv.appendChild(nowPlayingIcon);
    songTitleDiv.appendChild(nowPlayingIcon);
  
    // Append song title and artist to song-info
    songInfoDiv.appendChild(songTitleDiv);
    songInfoDiv.appendChild(songArtistDiv);
  
    // Append user-info and song-info to the main block
    blockDiv.appendChild(userInfoDiv);
    blockDiv.appendChild(songInfoDiv);
  
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

        block.querySelector(".song-info > .song-title > span").innerHTML = recentTrack.name;
        block.querySelector(".song-info > .song-artist > span").innerHTML = recentTrack.artist["#text"];
        const imageUrl = recentTrack.image[3]["#text"];
        block.style.backgroundImage = `url(${imageUrl})`;

        const nowPlaying = recentTrack["@attr"]?.nowplaying;
        if (nowPlaying) {
            block.dataset.nowPlaying = "true";
            block.getElementsByClassName("playing-icon")[0].style.visibility = "visible";
            block.dataset.date = Math.floor(Date.now() / 1000);

        } else {
            block.dataset.nowPlaying = "false";
            block.getElementsByClassName("playing-icon")[0].style.visibility = "hidden";
            block.dataset.date = recentTrack.date.uts;
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

// API URL
const apiUrl = "https://ws.audioscrobbler.com/2.0/?method=user.getfriends&user=" + getUsernameFromURL() + "&api_key=24e68c864088b9726a71eb31b4567cad&format=json";

// Fetch data from the Last.fm API
fetch(apiUrl)
    .then((response) => {
        if (!response.ok) {
            throw new Error("Network error");
        }
        return response.json(); // Parse JSON
    })
    .then((data) => {
        // Access the friends array from the API response
        const friends = data.friends.user;

        // Get the container where the data will be displayed
        const blockContainer = document.getElementById("block-container");

        // Iterate through friends and display their details
        friends.forEach((friend) => {
            const imageUrl = friend.image[3]["#text"];
            // Create a div for each friend
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

setInterval(updateAllBlocks, 30000);

