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
    const playsText = `${plays.toLocaleString()} ${parseInt(plays, 10) === 1 ? 'play' : 'plays'}`;
    const lastListen = span.dataset.lastListen;

    // Check if this listener is currently listening to this artist/album/track
    const currentTrack = chartDataPerUser[username].recentTracks?.[0];
    const itemType = span.dataset.itemType;
    const itemName = span.dataset.itemName;
    const itemArtist = span.dataset.itemArtist;
    let isNowPlaying = false;
    if (currentTrack?.["@attr"]?.nowplaying) {
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

    // Constants for mini bar chart
    const MAX_HEIGHT_PX = 16;
    const FLOOR_PX = 3;

    // Build mini bar chart for weekly plays
    const DAY_ABBRS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const today = new Date();
    const days = span.dataset.dailyData.split(",").map((s) => {
        const parts = s.split(":");
        return { count: parseInt(parts[1], 10) };
    });

    // Global max single-day count across all users for this item
    let globalMaxDayCount = Math.max(...days.map(d => d.count), 1);
    Object.values(chartDataPerUser).forEach(userData => {
        let dailyData = null;
        if (itemType === 'artist') {
            dailyData = userData.artistPlays?.[itemName]?.dailyData;
        } else if (itemType === 'album') {
            dailyData = userData.albumPlays?.[`${itemName}::${itemArtist}`]?.dailyData;
        } else if (itemType === 'track') {
            dailyData = userData.trackPlays?.[`${itemName}::${itemArtist}`]?.dailyData;
        }
        if (dailyData) {
            const userDayMax = Math.max(...dailyData.map(d => d.count));
            if (userDayMax > globalMaxDayCount) globalMaxDayCount = userDayMax;
        }
    });

    const userMaxDayCount = Math.max(...days.map(d => d.count));
    const cols = days
        .map(({ count }, i) => {
            const isToday = i === days.length - 1;
            // x^0.75 scaling to reduce effect of outlier users
            const barHeight = count === 0 ? 0 : Math.round(FLOOR_PX + (Math.pow(count, 0.75) / Math.pow(globalMaxDayCount, 0.75)) * (MAX_HEIGHT_PX - FLOOR_PX));
            const isPeak = count === userMaxDayCount && count > 0 && barHeight >= MAX_HEIGHT_PX * 0.4;
            const date = new Date(today);
            date.setDate(today.getDate() - (days.length - 1 - i));
            const label = DAY_ABBRS[date.getDay()];
            return (
                `<div class="day-col">` +
                `<div style="height:${MAX_HEIGHT_PX}px;display:flex;align-items:flex-end;">` +
                `<div class="day-fill${isPeak ? " peak" : ""}${isToday ? " today" : ""}" style="height:${barHeight}px"></div>` +
                `</div>` +
                `<div class="day-label${isToday ? " today" : ""}">${label}</div>` +
                `</div>`
            );
        })
        .join("");
    const barsHtml = `<div class="listener-tooltip-bars" style="margin-left: 2px;">${cols}</div>`;

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

