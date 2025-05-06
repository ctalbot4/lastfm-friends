// API
import { getJSONP } from "../../api/deezer.js";

// State
import { audioState } from "./index.js";

// Play preview for chart items
export async function playChartPreview(trackTitle, artistName, listItem, isArtist = false, isAlbum = false) {
    // Remove any question marks (causes issues with Deezer API)
    const sanitizedTrackTitle = trackTitle.replace(/\?/g, '');
    let url;
    let foundTrack;

    if (isAlbum) {
        // Search for tracks from this album and play the most popular one
        const query = `album:"${sanitizedTrackTitle}" artist:"${artistName}"`;
        const encodedQuery = encodeURIComponent(query);
        url = `https://api.deezer.com/search/track?q=${encodedQuery}&order=rank&output=jsonp`;
        try {
            const result = await getJSONP(url);

            // Get the most popular track with a preview
            foundTrack = result.data[0];
        } catch (e) {
            console.error('Error playing album preview:', e);
        }
    } else if (isArtist) {
        // Search for artist ID then get top tracks
        const encodedQuery = encodeURIComponent(sanitizedTrackTitle);
        url = `https://api.deezer.com/search/artist?q=${encodedQuery}&output=jsonp`;
        try {
            const result = await getJSONP(url);
            if (result.data[0]?.id) {
                const artistId = result.data[0].id;
                const tracksUrl = `https://api.deezer.com/artist/${artistId}/top?limit=5&output=jsonp`;
                const tracksResult = await getJSONP(tracksUrl);

                foundTrack = tracksResult.data[0];
            }
        } catch (e) {
            console.error('Error checking artist preview:', e);
        }
    } else {
        const query = `artist:"${artistName}" track:"${sanitizedTrackTitle}"`;
        const encodedQuery = encodeURIComponent(query);
        url = `https://api.deezer.com/search/track/?q=${encodedQuery}&output=jsonp`;

        const result = await getJSONP(url);

        // Find first result that contains matching word in artist and song name
        const trackWords = trackTitle.toLowerCase().split(/\s+/);
        const artistWords = artistName.toLowerCase().split(/\s+/);
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
        if (trackTitle.includes('(') && !foundTrack) {
            const newTitle = trackTitle.replace(/\(.*?\)/g, '').trim();
            playChartPreview(newTitle, artistName, listItem, false, false);
        }
    }
    if (foundTrack && foundTrack.preview) {
        // Stop any currently playing block preview
        if (audioState.currentAudio) {
            audioState.currentAudio.pause();
            audioState.currentAudio.currentTime = 0;
            // Reset any playing block previews
            document.querySelectorAll('.block[data-preview-playing="true"]').forEach(block => {
                block.dataset.previewPlaying = "false";
            });
            audioState.currentAudioBlock = null;
        }

        // Stop any currently playing chart preview
        if (audioState.currentChartAudio) {
            audioState.currentChartAudio.pause();
            audioState.currentChartAudio.currentTime = 0;
            // Reset other playing buttons
            document.querySelectorAll('.play-button.playing').forEach(button => {
                button.classList.remove('playing');
                button.querySelector('.play-icon').style.display = 'block';
                button.querySelector('.pause-icon').style.display = 'none';
            });
        }

        if (!audioState.currentChartAudio) {
            audioState.currentChartAudio = new Audio();
        }

        // Play the preview
        audioState.currentChartAudio.src = foundTrack.preview;
        audioState.currentChartAudio.play();

        const playButton = listItem.querySelector('.play-button');
        playButton.classList.add('playing');

        // Reset button state when preview ends
        audioState.currentChartAudio.onended = () => {
            playButton.classList.remove('playing');
            playButton.querySelector('.play-icon').style.display = 'block';
            playButton.querySelector('.pause-icon').style.display = 'none';
        };

        gtag('event', 'chart_play', {
            preview_track: foundTrack.title || 'unknown',
            preview_artist: foundTrack.artist.name || 'unknown'
        });
    }
}