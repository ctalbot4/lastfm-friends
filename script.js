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
    img.src = imageUrl;
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
  
    const songArtistDiv = document.createElement("div");
    songArtistDiv.className = "song-artist";
  
    // Append song title and artist to song-info
    songInfoDiv.appendChild(songTitleDiv);
    songInfoDiv.appendChild(songArtistDiv);
  
    // Append user-info and song-info to the main block
    blockDiv.appendChild(userInfoDiv);
    blockDiv.appendChild(songInfoDiv);
  
    return blockDiv;
}

function updateBlock(block) {
    const username = block.dataset.username;

    const friendUrl = "https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&limit=1&user=" + username + "&api_key=24e68c864088b9726a71eb31b4567cad&format=json";

    fetch(friendUrl)
        .then((response) => {
            if (!response.ok) {
                throw new Error("Network error");
            }
        return response.json()
        })
        .then((data) => {
            const recentTrack = data.recenttracks.track[0];
            block.querySelector(".song-info > .song-title").innerHTML = recentTrack.name;
            block.querySelector(".song-info > .song-artist").innerHTML = recentTrack.artist["#text"];
            const imageUrl = recentTrack.image[3]["#text"];
            block.style.backgroundImage = `url(${imageUrl})`;
        })
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
            
            updateBlock(blockDiv);
        });
    })
    .catch((error) => {
        console.error("Error fetching data:", error);
    });