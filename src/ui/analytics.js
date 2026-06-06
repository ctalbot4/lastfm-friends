// Google analytics events
export function initAnalytics() {
    document.body.addEventListener("click", function(event) {
        let target = event.target;

        // Track clicks in charts
        if (target.closest("#artists-list") && target.closest("a")) {
            gtag("event", "chart_click", {
                click_type: "artists",
                target_artist: target.textContent,
            });
        } else if (target.closest("#albums-list") && target.closest("a")) {
            gtag("event", "chart_click", {
                click_type: "albums",
                target_album: target.textContent,
            });
        } else if (target.closest("#tracks-list") && target.closest("a")) {
            gtag("event", "chart_click", {
                click_type: "tracks",
                target_track: target.textContent,
            });
        } else if (target.closest("#listeners-list") && target.closest("a")) {
            gtag("event", "chart_click", {
                click_type: "listeners",
                target_username: target.textContent,
            });
        }
        else if (target.closest("#unique-artists-list") && target.closest("a")) {
            gtag("event", "chart_click", {
                click_type: "unique_artists",
                target_artist: target.textContent,
            });
        } else if (target.closest("#unique-tracks-list") && target.closest("a")) {
            gtag("event", "chart_click", {
                click_type: "unique_tracks",
                target_track: target.textContent,
            });
        } else if (target.closest("#listening-streaks-list") && target.closest("a")) {
            gtag("event", "chart_click", {
                click_type: "listening_streaks",
                target_username: target.textContent,
            });
        } else if (target.closest("#artist-streaks-list") && target.closest("a")) {
            gtag("event", "chart_click", {
                click_type: "artist_streaks",
                target_artist: target.textContent,
            });
        } else if (target.closest("#album-streaks-list") && target.closest("a")) {
            gtag("event", "chart_click", {
                click_type: "album_streaks",
                target_album: target.textContent,
            });
        } else if (target.closest("#track-streaks-list") && target.closest("a")) {
            gtag("event", "chart_click", {
                click_type: "track_streaks",
                target_track: target.textContent,
            });
        } else if (target.closest("#tags-list") && target.closest("a")) {
            gtag("event", "chart_click", {
                click_type: "tags",
                target_tag: target.textContent,
            });
        }

        // Track clicks in block-container
        if (target.closest("#block-container")) {
            if (target.closest(".artist-title")) {
                gtag("event", "block_click", {
                    click_type: "artist",
                    target_artist: target.textContent,
                });
            } else if (target.closest(".song-title")) {
                gtag("event", "block_click", {
                    click_type: "track",
                    target_track: target.textContent,
                });
            } else if (target.closest(".info-button")) {
                const block = target.closest(".block");
                const username = block?.dataset.username;
                const artist = block?.querySelector(".artist-title > a").textContent.trim();
                const track = block?.querySelector(".song-title > a").textContent.trim();

                gtag("event", "info_click", {
                    target_username: username,
                    target_artist: artist,
                    target_track: track,
                });
            } else if (target.closest(".user-info")) {
                gtag("event", "block_click", {
                    click_type: "username",
                    target_username: target.textContent,
                });
            }
        }

        // Track clicks in ticker
        if (target.closest(".ticker-main")) {
            if (target.closest(".ticker-artist") && target.closest("a")) {
                gtag("event", "ticker_click", {
                    click_type: "artist",
                    target_artist: target.textContent,
                });
            } else if (target.closest(".ticker-album") && target.closest("a")) {
                gtag("event", "ticker_click", {
                    click_type: "album",
                    target_album: target.textContent,
                });
            } else if (target.closest(".ticker-track") && target.closest("a")) {
                gtag("event", "ticker_click", {
                    click_type: "track",
                    target_track: target.textContent,
                });
            }
        }
    });
}