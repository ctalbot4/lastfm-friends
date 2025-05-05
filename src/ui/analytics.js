// Google analytics events
export function initAnalytics() {
document.body.addEventListener("click", function(event) {
    let target = event.target;

    // Track clicks in charts
    if (target.closest("#artists-list") && target.closest("a")) {
        gtag("event", "chart_click", {
            click_type: "artists",
            artist_target: target.textContent,
        });
    } else if (target.closest("#albums-list") && target.closest("a")) {
        gtag("event", "chart_click", {
            click_type: "albums",
            album_target: target.textContent,
        });
    } else if (target.closest("#tracks-list") && target.closest("a")) {
        gtag("event", "chart_click", {
            click_type: "tracks",
            track_target: target.textContent,
        });
    }

    // Track clicks in block-container
    if (target.closest("#block-container")) {
        if (target.closest(".artist-title")) {
            gtag("event", "block_click", {
                click_type: "artist",
                artist_target: target.textContent,
            });
        } else if (target.closest(".song-title")) {
            gtag("event", "block_click", {
                click_type: "track",
                track_target: target.textContent,
            });
        } else if (target.closest(".info-button")) {
            gtag("event", "info_click", {});
        } else if (target.closest(".user-info")) {
            gtag("event", "block_click", {
                click_type: "username",
                user_target: target.textContent,
            });
        }
    }

    // Track clicks in ticker
    if (target.closest(".ticker-main")) {
        if (target.closest(".ticker-artist") && target.closest("a")) {
            gtag("event", "ticker_click", {
                click_type: "artist",
                artist_target: target.textContent,
            });
        } else if (target.closest(".ticker-album") && target.closest("a")) {
            gtag("event", "ticker_click", {
                click_type: "album",
                album_target: target.textContent,
            });
        } else if (target.closest(".ticker-track") && target.closest("a")) {
            gtag("event", "ticker_click", {
                click_type: "track",
                track_target: target.textContent,
            });
        }
    }
});
}