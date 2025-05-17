// State
import { store } from "../../state/store.js";

// API
import { getJSONP } from "../../api/deezer.js";

// Preview
import { audioState } from "./index.js";

// Search for block preview
export async function playBlockPreview(trackTitle, artistName, block) {
    // Remove any question marks (causes issues with Deezer API)
    const sanitizedTrackTitle = trackTitle.replace(/\?/g, '');

    const query = `artist:"${artistName}" track:"${sanitizedTrackTitle}"`;
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.deezer.com/search/track/?q=${encodedQuery}&output=jsonp`;

    const requestId = audioState.activeRequestId;
    const result = await getJSONP(url);
    if (requestId !== audioState.activeRequestId) {
        return;
    }
    // Find first fesult that contains matching word in artist and song name
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
        if (!audioState.currentAudio) {
            audioState.currentAudio = new Audio();
        }

        // Stop any playing chart preview
        if (audioState.currentChartAudio) {
            audioState.currentChartAudio.pause();
            audioState.currentChartAudio.currentTime = 0;
            // Reset any playing chart buttons
            document.querySelectorAll('.play-button.playing').forEach(button => {
                button.classList.remove('playing');
                button.querySelector('.play-icon').style.display = 'block';
                button.querySelector('.pause-icon').style.display = 'none';
            });
        }

        const previousAudioTime = parseFloat(block.dataset.previewTime);

        audioState.currentAudio.src = foundTrack.preview;
        audioState.currentAudio.currentTime = previousAudioTime > 27 ? 0 : previousAudioTime;
        audioState.currentAudio.play();

        audioState.currentAudioBlock = block;
        document.getElementById("block-container").querySelector(`[data-username="${block.dataset.username}"]`).dataset.previewPlaying = "true";

        // Reset preview state when audio ends
        audioState.currentAudio.onended = () => {
            document.getElementById("block-container").querySelector(`[data-username="${block.dataset.username}"]`).dataset.previewPlaying = "false";
        };

        gtag('event', 'block_play', {
            preview_trigger: store.isTouchDevice ? 'onscreen' : 'hover',
            preview_track: trackTitle || 'unknown',
            preview_artist: artistName || 'unknown'
        });
    } else if (trackTitle.includes('(')) {
        const newTitle = trackTitle.replace(/\(.*?\)/g, '').trim();
        console.log(`Retrying search without parentheses: "${newTitle}"`);
        playBlockPreview(newTitle, artistName, block);
    } else {
        console.log(`No preview found for "${trackTitle}" by "${artistName}"`);
    }
}