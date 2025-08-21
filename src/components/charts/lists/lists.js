// "Top Artists", "Top Albums", "Top Tracks", "Unique Artists", "Unique Tracks" charts

// API
import { getJSONP } from "../../../api/deezer.js";

// Blocks
import { userPlayCounts } from "../../blocks/update.js";

// Charts
import { userStats, userListeningTime } from "../update.js";

// Preview
import { audioState, hasPreview } from "../../preview/index.js";
import { playChartPreview } from "../../preview/charts.js";

// Helper function to format duration
function formatDuration(totalSeconds) {
    if (!totalSeconds) return "0s";
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    let string = "";
    if (days > 0) string += `${days}d `;
    if (hours > 0) {
        string += `${hours}h `;
    } else if (days === 0 && minutes > 0) {
        string += `${minutes}m `;
    } else if (days === 0 && seconds > 0) {
        string += `${seconds}s`;
    }
    return string || "0s";
}

// Create list item in chart
async function createListItem(itemData, maxPlays, isTrack = false, isAlbum = false) {
    const li = document.createElement("li");
    li.classList.add("list-item");

    // Check for preview availability on Deezer
    let hasPreviewAvailable = false;
    try {
        if (isTrack) {
            hasPreviewAvailable = itemData.preview ? true : false;
        } else if (isAlbum) {
            hasPreviewAvailable = await hasPreview(itemData.name, itemData.artist, false, true);
        } else {
            hasPreviewAvailable = itemData.image ? true : false;
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

    // Add preview functionality if available
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

    // Add listener avatars
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
        span.dataset.plays = `${listener.plays.toLocaleString()} ${listener.plays === 1 ? 'play' : 'plays'}`;

        span.innerHTML = `<img class="listener-img" src="${listener.img}">`;
        li.querySelector(".listeners").appendChild(span);
        imgIndex--;
    }

    return li;
}

// Create artist charts with Deezer images and previews
export async function createArtistCharts(sortedArtistPlays, artistsMax) {
    // Process artists
    const artistChartPromises = sortedArtistPlays.map(async (artistData) => {
        const [artistName, artistInfo] = artistData;
        const artistUsers = Object.entries(artistInfo.users);
        artistUsers.sort((a, b) => b[1] - a[1]);

        // Fetch artist image from Deezer
        let imageUrl;
        try {
            const fetchUrl = `https://api.deezer.com/search/artist?q="${artistName}"&output=jsonp`;
            const response = await getJSONP(fetchUrl);
            imageUrl = response.data[0]?.picture;
        } catch (error) {
            console.error(`Error fetching artist image for ${artistName}:`, error);
            imageUrl = null;
        }

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
    const listItemPromises = artistResults.map(data => createListItem(data, artistsMax));
    return await Promise.all(listItemPromises);
}

// Create album charts with previews
export async function createAlbumCharts(sortedAlbumPlays, albumsMax) {
    // Process albums
    const albumChartPromises = sortedAlbumPlays.map(async (albumData) => {
        const [key, albumInfo] = albumData;
        const albumUsers = Object.entries(albumInfo.users);

        const sortedAlbumUsers = albumUsers.sort((a, b) => b[1] - a[1]);

        return {
            name: albumInfo.albumName,
            artist: albumInfo.artist,
            plays: albumInfo.plays,
            image: albumInfo.img,
            url: albumInfo.url,
            artistUrl: albumInfo.artistUrl,
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
    const listItemPromises = albumResults.map(data => createListItem(data, albumsMax, false, true));
    return await Promise.all(listItemPromises);
}

// Create track charts with Deezer images and previews
export async function createTrackCharts(sortedTrackPlays, tracksMax) {
    // Process tracks
    const trackChartPromises = sortedTrackPlays.map(async (trackData) => {
        const trackInfo = trackData[1];
        const trackUsers = Object.entries(trackInfo.users);

        const sortedTrackUsers = trackUsers.sort((a, b) => b[1] - a[1]);

        // Search for track on Deezer to get album image and preview
        const sanitizedTrackTitle = trackInfo.trackName.replace(/\?/g, '');
        const query = `artist:"${trackInfo.artist}" track:"${sanitizedTrackTitle}"`;
        const encodedQuery = encodeURIComponent(query);
        const url = `https://api.deezer.com/search/track/?q=${encodedQuery}&output=jsonp`;

        let foundTrack = null;
        try {
            const result = await getJSONP(url);

            // Find first result that contains matching word in artist and song name
            const trackWords = trackInfo.trackName.toLowerCase().split(/\s+/);
            const artistWords = trackInfo.artist.toLowerCase().split(/\s+/);

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
        } catch (error) {
            console.error(`Error fetching track data for ${trackInfo.trackName}:`, error);
            foundTrack = null;
        }

        return {
            name: trackInfo.trackName,
            artist: trackInfo.artist,
            plays: trackInfo.plays,
            url: trackInfo.trackUrl,
            artistUrl: trackInfo.artistUrl,
            image: foundTrack?.album?.cover_medium,
            preview: foundTrack?.preview,
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
    const listItemPromises = trackResults.map(data => createListItem(data, tracksMax, true));
    return await Promise.all(listItemPromises);
}

// Create top listeners chart
export function createTopListenersChart(sortedListeners, maxDuration) {

    const listenerItems = sortedListeners.map(([username, totalSeconds]) => {
        const li = document.createElement("li");
        li.classList.add("list-item");

        const userBlock = document.querySelector(`[data-username="${username}"]`);
        const profilePic = userBlock?.querySelector('.profile-picture img').src || "https://lastfm.freetls.fastly.net/i/u/avatar170s/818148bf682d429dc215c1705eb27b98.png";
        const userUrl = `https://www.last.fm/user/${username}`;
        const totalPlays = userPlayCounts[username] || 0;

        li.innerHTML = `
            <div class="bar" style="width: ${15 + (totalSeconds / maxDuration) * 85}%;"></div>
            <div class="image-container listener-image-container" style="background-image: url('${profilePic}');">
            </div>
            <div class="item-info">
                <div class="item-name">
                    <a href="${userUrl}" target="_blank">${username}</a>
                </div>
                <div class="item-subtext">
                    <span class="plays">${formatDuration(totalSeconds)}${totalPlays > 0 ? ` - ${totalPlays.toLocaleString()} plays` : ""}</span>
                </div>
            </div>
        `;

        return li;
    });
    return listenerItems;
}

// Create unique artists chart with plays per artist
export function createUniqueArtistsChart(sortedUsers, maxArtists) {

    const listenerItems = sortedUsers.map(([username, stats]) => {
        const li = document.createElement("li");
        li.classList.add("list-item");

        const userBlock = document.querySelector(`[data-username="${username}"]`);
        const profilePic = userBlock?.querySelector('.profile-picture img').src || "https://lastfm.freetls.fastly.net/i/u/avatar170s/818148bf682d429dc215c1705eb27b98.png";
        const userUrl = `https://www.last.fm/user/${username}`;
        const totalPlays = userPlayCounts[username] || 0;

        li.innerHTML = `
            <div class="bar" style="width: ${15 + (stats.totalArtists / maxArtists) * 85}%;"></div>
            <div class="image-container listener-image-container" style="background-image: url('${profilePic}');">
            </div>
            <div class="item-info">
                <div class="item-name">
                    <a href="${userUrl}" target="_blank">${username}</a>
                </div>
                <div class="item-subtext">
                    <span class="plays">${stats?.totalArtists.toLocaleString()} artists${totalPlays > 0 ? ` - ${(totalPlays / stats.totalArtists).toFixed(2).toLocaleString()} plays per artist` : ""}</span>
                </div>
            </div>
        `;

        return li;
    });
    return listenerItems;
}

// Create unique tracks chart with plays per track
export function createUniqueTracksChart(sortedUsers, maxTracks) {

    const listenerItems = sortedUsers.map(([username, stats]) => {
        const li = document.createElement("li");
        li.classList.add("list-item");

        const userBlock = document.querySelector(`[data-username="${username}"]`);
        const profilePic = userBlock?.querySelector('.profile-picture img').src || "https://lastfm.freetls.fastly.net/i/u/avatar170s/818148bf682d429dc215c1705eb27b98.png";
        const userUrl = `https://www.last.fm/user/${username}`;
        const totalPlays = userPlayCounts[username] || 0;

        li.innerHTML = `
            <div class="bar" style="width: ${15 + (stats.totalTracks / maxTracks) * 85}%;"></div>
            <div class="image-container listener-image-container" style="background-image: url('${profilePic}');">
            </div>
            <div class="item-info">
                <div class="item-name">
                    <a href="${userUrl}" target="_blank">${username}</a>
                </div>
                <div class="item-subtext">
                    <span class="plays">${stats?.totalTracks.toLocaleString()} tracks${totalPlays > 0 ? ` - ${(totalPlays / stats.totalTracks).toFixed(2).toLocaleString()} plays per track` : ""}</span>
                </div>
            </div>
        `;

        return li;
    });
    return listenerItems;
}