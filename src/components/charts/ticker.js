export function updateTickerDisplay(sortedArtistPlays, sortedAlbumPlays, sortedTrackPlays) {
    // Update artist ticker
    document.querySelectorAll(".ticker-artist > .value > a").forEach(element => {
        element.innerText = sortedArtistPlays[0][0];
    });
    document.querySelectorAll(".ticker-artist > .subtext").forEach(element => {
        element.innerText = `(${sortedArtistPlays[0][1].plays} plays)`;
    });
    document.querySelectorAll(".ticker-artist > .value > a").forEach(element => {
        element.href = sortedArtistPlays[0][1].url;
    });

    // Update album ticker
    document.querySelectorAll(".ticker-album > .value > a").forEach(element => {
        element.innerText = sortedAlbumPlays[0][1].albumName;
    });
    document.querySelectorAll(".ticker-album > .subtext").forEach(element => {
        element.innerText = `(${sortedAlbumPlays[0][1].plays} plays)`;
    });
    document.querySelectorAll(".ticker-album > .value > a").forEach(element => {
        element.href = sortedAlbumPlays[0][1].url;
    });

    // Update track ticker
    document.querySelectorAll(".ticker-track > .value > a").forEach(element => {
        element.innerText = sortedTrackPlays[0][1].trackName;
    });
    document.querySelectorAll(".ticker-track> .subtext").forEach(element => {
        element.innerText = `(${sortedTrackPlays[0][1].plays} plays)`;
    });
    document.querySelectorAll(".ticker-track > .value > a").forEach(element => {
        element.href = sortedTrackPlays[0][1].trackUrl;
    });
}