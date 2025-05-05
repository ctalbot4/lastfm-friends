// JSONP helper
export function getJSONP(url) {
    return new Promise((resolve, reject) => {
        const callbackName = "jsonp_callback_" + Math.round(100000 * Math.random());
        const timeout = setTimeout(() => {
            reject(new Error('JSONP request timed out'));
            delete window[callbackName];
            document.removeChild(script);
        }, 5000);

        window[callbackName] = function(data) {
            clearTimeout(timeout);
            resolve(data);
            delete window[callbackName];
            document.body.removeChild(script);
        };

        const script = document.createElement("script");
        script.src = `${url}&callback=${callbackName}`;
        document.body.appendChild(script);
    });
}

// Search for preview and retry if not found
export async function searchPreview(trackTitle, artistName, block, retried = false) {
    // Remove any question marks (causes issues with Deezer API)
    const sanitizedTrackTitle = trackTitle.replace(/\?/g, '');

    const query = `artist:"${artistName}" track:"${sanitizedTrackTitle}"`;
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.deezer.com/search/track/?q=${encodedQuery}&output=jsonp`;

    const requestId = activeRequestId;
    const result = await getJSONP(url);
    if (requestId !== activeRequestId) {
        return;
    }
    // Find first fesult that contains matching word in artist and song name 
    // (API often gives some random irrelevant results)
    const trackWords = trackTitle.toLowerCase().split(/\s+/);
    const artistWords = artistName.toLowerCase().split(/\s+/);
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

    if (foundTrack && foundTrack.preview) {
        if (!currentAudio) {
            currentAudio = new Audio();
        }

        const previousAudioTime = parseFloat(block.dataset.previewTime);

        currentAudio.src = foundTrack.preview;
        currentAudio.currentTime = previousAudioTime > 27 ? 0 : previousAudioTime;
        currentAudio.play();

        currentAudioBlock = block;
        document.getElementById("block-container").querySelector(`[data-username="${block.dataset.username}"]`).dataset.previewPlaying = "true";
        previewTimers[block.dataset.username] = setTimeout(() => {
            document.getElementById("block-container").querySelector(`[data-username="${block.dataset.username}"]`).dataset.previewPlaying = "false";
        }, (30 - currentAudio.currentTime) * 1000);

        gtag('event', 'song_play', {
            preview_trigger: isTouchDevice ? 'onscreen' : 'hover',
            preview_track: trackTitle || 'unknown',
            preview_artist: artistName || 'unknown'
        });
    } else if (!retried && trackTitle.includes('(')) {
        const newTitle = trackTitle.replace(/\(.*?\)/g, '').trim();
        console.log(`Retrying search without parentheses: "${newTitle}"`);
        searchPreview(newTitle, artistName, block, true);
    } else {
        console.log(`No preview found for "${trackTitle}" by "${artistName}"`);
    }
}