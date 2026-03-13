// Charts
import { chartDataPerUser } from "../update.js";

function getListenerTooltip() {
    let tooltipEl = document.getElementById("listener-tooltip");
    if (!tooltipEl) {
        tooltipEl = document.createElement("div");
        tooltipEl.id = "listener-tooltip";
        tooltipEl.className = "listener-tooltip";
        document.body.appendChild(tooltipEl);

        // Hide if the charts panel scrolls
        document.querySelector(".charts-scrollable").addEventListener("scroll", hideListenerTooltip, { passive: true });
    }
    return tooltipEl;
}

export function showListenerTooltip(span, streak) {
    const tooltip = getListenerTooltip();

    const username = span.dataset.user;
    const plays = span.dataset.plays;
    const playsText = `${plays.toLocaleString()} ${plays === 1 ? 'play' : 'plays'}`;
    const lastListen = span.dataset.lastListen;

    // Check if this listener is currently listening to this artist/album/track
    const currentTrack = chartDataPerUser[username].recentTracks?.[0];
    const itemType = span.dataset.itemType;
    const itemName = span.dataset.itemName;
    const itemArtist = span.dataset.itemArtist;
    let isNowPlaying = false;
    if (currentTrack?.["@attr"]?.nowplaying && itemType) {
        if (itemType === "artist") {
            isNowPlaying = currentTrack.artist.name === itemName;
        } else if (itemType === "album") {
            isNowPlaying =
                currentTrack.artist.name === itemArtist &&
                currentTrack.album["#text"] === itemName;
        } else if (itemType === "track") {
            isNowPlaying =
                currentTrack.artist.name === itemArtist &&
                currentTrack.name.trim() === itemName;
        }
    }

    const playsLine = streak ? streak != plays ? `${playsText} (${streak.toLocaleString()} in a row)` : `${playsText} in a row` : playsText;
    let recencyText = null;
    if (isNowPlaying) {
        recencyText = "listening now";
    } else if (lastListen) {
        recencyText =
            lastListen === "just now"
                ? "last played just now"
                : `last listened ${lastListen}`;
    }

    // Build mini bar chart for weekly plays
    let barsHtml = "";
    const rawData = span.dataset.dailyData;
    if (rawData) {
        const days = rawData.split(",").map((s) => {
            const [label, ratio] = s.split(":");
            return { label, ratio: parseFloat(ratio) };
        });
        const maxRatio = Math.max(...days.map((d) => d.ratio), 0.001);
        const cols = days
            .map(({ label, ratio }, i) => {
                const isToday = i === days.length - 1;
                const heightPx = Math.round((ratio / maxRatio) * 16);
                const isPeak = ratio === maxRatio && ratio > 0;
                return (
                    `<div class="day-col">` +
                    `<div class="day-fill${isPeak ? " peak" : ""}${isToday ? " today" : ""}" style="height:${heightPx}px"></div>` +
                    `<div class="day-label${isToday ? " today" : ""}">${label}</div>` +
                    `</div>`
                );
            })
            .join("");
        barsHtml = `<div class="listener-tooltip-bars" style="margin-left: 2px;">${cols}</div>`;
    }

    const recencyHtml = recencyText
        ? `<div class="listener-tooltip-recency">${
              isNowPlaying ? '<img src="icons/playing.gif" class="now-icon">' : ""
          }${recencyText}</div>`
        : "";

    tooltip.innerHTML =
        `<div class="listener-tooltip-name">${username}</div>` +
        `<div class="listener-tooltip-plays">${playsLine}</div>` +
        recencyHtml +
        barsHtml;

    const rect = span.getBoundingClientRect();
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;

    let left = rect.left + rect.width / 2 - tw / 2;
    let top = rect.bottom + 8;

    // Ensure tooltip doesn't go off the screen
    if (left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8;
    if (left < 8) left = 8;
    if (top + th > window.innerHeight - 8) top = rect.top - th - 8;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.add("visible");
}

export function hideListenerTooltip() {
    const tooltipEl = document.getElementById("listener-tooltip");
    if (tooltipEl) {
        tooltipEl.classList.remove("visible");
    }
}

