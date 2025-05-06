// API
import { getJSONP } from "../../api/deezer.js";

// Components
import { hasPreview, audioState } from "../preview/index.js";
import { playChartPreview } from "../preview/charts.js";

// Create list item in chart
async function createChartItem(itemData, maxPlays, isTrack = false, isAlbum = false) {
    const li = document.createElement("li");
    li.classList.add("list-item");

    // Check for preview availability on Deezer
    let hasPreviewAvailable = false;
    try {
        if (isTrack) {
            hasPreviewAvailable = await hasPreview(itemData.name, itemData.artist, null, null);
        } else if (isAlbum) {
            hasPreviewAvailable = await hasPreview(itemData.name, itemData.artist, false, true);
        } else {
            hasPreviewAvailable = await hasPreview(itemData.name, null, true, null);
        }
    } catch (e) {
        console.error('Error checking preview:', e);
        hasPreviewAvailable = false;
    }

    li.innerHTML =
        `<div class="bar" style="width: ${15 + (itemData.plays / maxPlays) * 85}%;"></div>
          <div class="image-container">
              <img class="item-image" src="${itemData.image || 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.jpg'}">
              ${hasPreviewAvailable ?
                `<button class="play-button overlay" title="Play preview">
                    <img src="icons/play.svg" class="play-icon">
                    <img src="icons/pause.svg" class="pause-icon" style="display: none;">
                </button>` :
                ``
              }
          </div>
          <div class="item-info">
            <div class="item-name">
              <a href="${itemData.url}" target="_blank">${itemData.name}</a>
            </div>
            <div class="item-subtext">
              ${isTrack || isAlbum ? `<span class="artist-subtext"><a href="${itemData.artistUrl}" target="_blank">${itemData.artist}</a></span>` : ""}
              <span class="plays">${(isTrack || isAlbum) ? `- ` : ""}${itemData.plays.toLocaleString()} plays</span>
            </div>
          </div>
        <div class="listeners">
        </div>`

    if (hasPreviewAvailable) {
        const playButton = li.querySelector('.play-button.overlay');
        const playIcon = playButton.querySelector('.play-icon');
        const pauseIcon = playButton.querySelector('.pause-icon');
        
        playButton.addEventListener('click', async () => {
            if (playButton.classList.contains('playing')) {
                // Pause the preview
                audioState.currentChartAudio.pause();
                playButton.classList.remove('playing');
                playIcon.style.display = 'block';
                pauseIcon.style.display = 'none';
            } else {
                // Play the preview
                await playChartPreview(itemData.name, isTrack || isAlbum ? itemData.artist : null, li, !isTrack && !isAlbum, isAlbum);
                playIcon.style.display = 'none';
                pauseIcon.style.display = 'block';
            }
        });
    }

    let imgIndex = 2;
    const count = itemData.listeners.length;
    for (let i = 2; i >= 0; i--) {
        const span = document.createElement("span");
        span.classList.add("listener-container");
        span.style.left = `${imgIndex * 18}px`;
        span.style.zIndex = imgIndex;
        // Make "+X" circle if necessary
        if (i == 2 && count > 3) {
            span.innerHTML = `+${count - 2}`;
            span.classList.add("others");
            li.querySelector(".listeners").appendChild(span);
            imgIndex--;
            continue;
        } else if (i + 1 > count) {
            continue;
        }
        const listener = itemData.listeners[i];
        span.dataset.user = listener.user;
        span.dataset.plays = listener.plays;

        span.innerHTML = `<img class="listener-img" src="${listener.img}">`;
        li.querySelector(".listeners").appendChild(span);
        imgIndex--;
    }

    return li;
}

export async function createArtistCharts(sortedArtistPlays) {
    let artistsMax = 0;
    const artistsList = document.getElementById("artists-list");

    const artistChartPromises = sortedArtistPlays.slice(0, 9).map(async (artistData) => {
        const [artistName, artistInfo] = artistData;
        const artistUsers = Object.entries(artistInfo.users);
        artistUsers.sort((a, b) => b[1] - a[1]);

        artistsMax = Math.max(artistsMax, artistInfo.plays);

        const fetchUrl = `https://api.deezer.com/search/artist?q="${artistName}"&output=jsonp`;
        const imageUrl = (await getJSONP(fetchUrl)).data[0]?.picture;
        return {
            name: artistName,
            plays: artistInfo.plays,
            image: imageUrl,
            url: artistInfo.url,
            listeners: artistUsers.map(([username, plays]) => ({
                user: username,
                img: document.querySelector(`[data-username="${username}"] .profile-picture img`) ?
                    document.querySelector(`[data-username="${username}"] .profile-picture img`).src : "https://lastfm.freetls.fastly.net/i/u/avatar170s/818148bf682d429dc215c1705eb27b98.png",
                plays: plays,
                url: ``
            }))
        };
    });

    const artistResults = await Promise.all(artistChartPromises);
    artistsList.innerHTML = '';
    const listItemPromises = artistResults.map(data => createChartItem(data, artistsMax));
    const listItems = await Promise.all(listItemPromises);
    listItems.forEach(item => artistsList.appendChild(item));
}

export async function createAlbumCharts(sortedAlbumPlays) {
    let albumsMax = 0;
    const albumsList = document.getElementById("albums-list");

    const albumChartPromises = sortedAlbumPlays.slice(0, 9).map(async (albumData) => {
        const [key, albumInfo] = albumData;
        const albumUsers = Object.entries(albumInfo.users);

        albumsMax = Math.max(albumsMax, albumInfo.plays);

        const sortedAlbumUsers = albumUsers.sort((a, b) => b[1] - a[1]);

        return {
            name: albumInfo.albumName,
            artist: albumInfo.artist,
            plays: albumInfo.plays,
            image: albumInfo.img,
            url: albumInfo.url,
            listeners: sortedAlbumUsers.map(([username, plays]) => ({
                user: username,
                img: document.querySelector(`[data-username="${username}"] .profile-picture img`) ?
                    document.querySelector(`[data-username="${username}"] .profile-picture img`).src : "https://lastfm.freetls.fastly.net/i/u/avatar170s/818148bf682d429dc215c1705eb27b98.png",
                plays: plays,
                url: ``
            }))
        };
    });

    const albumResults = await Promise.all(albumChartPromises);
    albumsList.innerHTML = '';
    const listItemPromises = albumResults.map(data => createChartItem(data, albumsMax, false, true));
    const listItems = await Promise.all(listItemPromises);
    listItems.forEach(item => albumsList.appendChild(item));
}

export async function createTrackCharts(sortedTrackPlays) {
    let tracksMax = 0;
    const tracksList = document.getElementById("tracks-list");

    const trackChartPromises = sortedTrackPlays.slice(0, 9).map(async (trackData) => {
        const trackInfo = trackData[1];
        const trackUsers = Object.entries(trackInfo.users);

        tracksMax = Math.max(tracksMax, trackInfo.plays);

        const sortedTrackUsers = trackUsers.sort((a, b) => b[1] - a[1]);

        // Search for the track on Deezer to get album image
        const sanitizedTrackTitle = trackInfo.trackName.replace(/\?/g, '');
        const query = `artist:"${trackInfo.artist}" track:"${sanitizedTrackTitle}"`;
        const encodedQuery = encodeURIComponent(query);
        const url = `https://api.deezer.com/search/track/?q=${encodedQuery}&output=jsonp`;
        
        const result = await getJSONP(url);
        
        // Find first result that contains matching word in artist and song name
        const trackWords = trackInfo.trackName.toLowerCase().split(/\s+/);
        const artistWords = trackInfo.artist.toLowerCase().split(/\s+/);
        
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

        // If no match found and title has parentheses, try without
        if (!foundTrack && trackInfo.trackName.includes('(')) {
            const newTitle = trackInfo.trackName.replace(/\(.*?\)/g, '').trim();
            const newQuery = `artist:"${trackInfo.artist}" track:"${newTitle}"`;
            const newEncodedQuery = encodeURIComponent(newQuery);
            const newUrl = `https://api.deezer.com/search/track/?q=${newEncodedQuery}&output=jsonp`;
            
            const newResult = await getJSONP(newUrl);

            
            const newTrackWords = newTitle.toLowerCase().split(/\s+/);
            for (let track of newResult.data) {
                const resultTrackTitle = track.title.toLowerCase();
                const resultArtistName = track.artist.name.toLowerCase();
                const trackMatches = newTrackWords.some(word => resultTrackTitle.includes(word));
                const artistMatches = artistWords.some(word => resultArtistName.includes(word));

                if (trackMatches && artistMatches) {
                    foundTrack = track;
                    break;
                }
            }
        }

        return {
            name: trackInfo.trackName,
            artist: trackInfo.artist,
            plays: trackInfo.plays,
            url: trackInfo.trackUrl,
            artistUrl: trackInfo.artistUrl,
            image: foundTrack?.album?.cover_medium,
            listeners: sortedTrackUsers.map(([username, plays]) => ({
                user: username,
                img: document.querySelector(`[data-username="${username}"] .profile-picture img`) ?
                    document.querySelector(`[data-username="${username}"] .profile-picture img`).src : "https://lastfm.freetls.fastly.net/i/u/avatar170s/818148bf682d429dc215c1705eb27b98.png",
                plays: plays,
                url: ``
            }))
        };
    });

    const trackResults = await Promise.all(trackChartPromises);
    tracksList.innerHTML = '';
    const listItemPromises = trackResults.map(data => createChartItem(data, tracksMax, true));
    const listItems = await Promise.all(listItemPromises);
    listItems.forEach(item => tracksList.appendChild(item));
}
