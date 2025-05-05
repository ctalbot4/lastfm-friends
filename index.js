function goToUser() {
    const username = document.getElementById('userInput').value;
    if (username) {
        localStorage.setItem("lastUser", username);
        window.location.href = `dashboard#${username}`;
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

// Stop mobile scrolling
window.addEventListener('load', function() {
    setTimeout(function() {
        window.scrollTo(0, 0);
    }, 100);
});

document.getElementById('userInput').addEventListener('focus', function() {
    document.body.classList.add('prevent-scroll');
});

document.getElementById('userInput').addEventListener('blur', function() {
    document.body.classList.remove('prevent-scroll');
});

document.addEventListener("touchmove", function(event) {
    event.preventDefault();
}, {
    passive: false
});

// Fetch background art
const userUrl = `https://ws.audioscrobbler.com/2.0/?method=user.gettopalbums&user=${lastUser}&limit=100&period=12month&api_key=1c4a67a2eacf14e735edb9e4475d3237&format=json`;

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