// Create a block with user info
export function createBlock(user, mainUser = false) {
    const username = user.name;
    const userUrl = user.url;
    const imageUrl = user.image[3]["#text"];
    const blockDiv = document.createElement("div");
    blockDiv.classList.add("block");
    if (mainUser) blockDiv.classList.add("main-user");
    blockDiv.setAttribute("data-username", username);

    const blockHTML = `
    <div class="user-info">
        <div class="profile-picture">
            <a href="${userUrl}" target="_blank">
                <img id="pfp" src="${imageUrl || 'https://lastfm.freetls.fastly.net/i/u/avatar170s/818148bf682d429dc215c1705eb27b98.png'}">
            </a>
        </div>
        <div class="username"><a href=${userUrl} target="_blank">${username}</a></div>
            <div class="info-button">
                 <img src="icons/friends.svg">
            </div>
    </div>
    <div class="listeners-container">
        <div class="listeners-header">
            <div class="listeners-title">Who listens to this track?</div>
            <div class="close-listeners">
                <svg viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            </div>
        </div>
        <div class="listeners-content">

        </div>
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