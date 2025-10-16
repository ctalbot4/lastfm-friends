// Create a block with user info
export function createBlock(user, mainUser = false) {
    const username = user.name;
    const userUrl = user.url;
    const imageUrl = user.image[3]["#text"];
    const cacheBustedImageUrl = imageUrl ? `${imageUrl}?cb=${Date.now()}` : 'https://lastfm.freetls.fastly.net/i/u/avatar170s/818148bf682d429dc215c1705eb27b98.png';
    const blockDiv = document.createElement("div");
    blockDiv.classList.add("block");
    if (mainUser) blockDiv.classList.add("main-user");
    blockDiv.setAttribute("data-username", username);

    const blockHTML = `
    <div class="user-info">
        <div class="profile-picture">
            <a href="${userUrl}" target="_blank">
                <img id="pfp" src="${cacheBustedImageUrl}">
            </a>
        </div>
        <div class="username"><a href=${userUrl} target="_blank">${username}</a></div>
            <div class="info-button">
                 <img src="icons/friends.svg">
            </div>
    </div>
    <div class="listeners-container">
        <div class="listeners-header" style="display: none;">
            <div class="listeners-tabs">
                <button class="listeners-tab active" data-tab="track">
                    <img class="tab-image album-image" src="" alt="" style="display: none;">
                    <span>Track</span>
                </button>
                <button class="listeners-tab" data-tab="artist">
                    <img class="tab-image artist-image" src="" alt="" style="display: none;">
                    <span>Artist</span>
                </button>
            </div>
            <div class="close-listeners">
                <svg viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            </div>
        </div>
        <div class="listeners-content-track" style="display: none;">

        </div>
        <div class="listeners-content-artist" style="display: none;">

        </div>
    </div>
    <div class="bottom">
        <div class="track-info">
            <div class="song-title">
                <a href="" target="_blank">
                    <span class="rest"></span>
                    <span class="no-break"></span>
                </a>
            </div>
            <div class="artist-title">
                <a href="" target="_blank">
                    <span class="rest"></span>
                    <span class="no-break"></span>
                </a>
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