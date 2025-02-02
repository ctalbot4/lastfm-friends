function goToUser() {
    const username = document.getElementById('userInput').value;
    if (username) {
        localStorage.setItem("lastUser", username);
        window.location.href = `/lastfm-friends/dashboard#${username}`;
    }
}

let lastUser;

if (localStorage.getItem("lastUser") !== null) {
    lastUser = localStorage.getItem("lastUser");
} else {
    lastUser = "ctalbot4";
}

document.getElementById("userInput").addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        goToUser();
    }
});

// Attempt at stopping mobile scrolling

document.addEventListener("touchmove", function(event) {
    event.preventDefault();
}, { passive: false });

const userUrl = `https://ws.audioscrobbler.com/2.0/?method=user.gettopalbums&user=${lastUser}&limit=100&period=12month&api_key=1c4a67a2eacf14e735edb9e4475d3237&format=json`;
    
// Fetch user data
const userFetch = fetch(userUrl)
    .then((response) => {
        if (!response.ok) {
            throw new Error("Network error");
        }
        return response.json();
    })
    .then((data) => {
        const container = document.querySelector('.background');

            data.topalbums.album.forEach(album => {
                const imageUrl = album.image[3]["#text"];
                const albumDiv = document.createElement('div');
                albumDiv.className = 'block';
                albumDiv.style.backgroundImage = `url('${imageUrl}')`;

                container.appendChild(albumDiv);
            })
    })
    .catch((error) => {
        console.error("Error fetching user data:", error);
    });