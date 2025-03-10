// Create list item in chart
function createListItem(itemData, maxPlays, isTrack = false) {
    const li = document.createElement("li");
    li.classList.add("list-item");
    li.innerHTML =
        `<div class="bar" style="width: ${15 + (itemData.plays / maxPlays) * 85}%;"></div>
          <img class="item-image${isTrack ? ' removed"' : ` " src="${itemData.image}"`}>
          <div class="item-info"${isTrack ? ' style="padding-left: 16px"' : ""}>
            <div class="item-name"><a href="${itemData.url}" target="_blank">${itemData.name}</a></div>
            <div class="item-subtext">
              <span class="artist-subtext${isTrack ? "" : " removed"}">${isTrack ? `<a href="${itemData.artistUrl}" target="_blank">${itemData.artist}</a>` : ""}</span>
              <span class="plays">${isTrack ? `- ` : ""}${itemData.plays.toLocaleString()} plays</span>
            </div>
          </div>
        <div class="listeners">
        </div>`

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

// Open/close charts
const chartToggle = document.getElementById('chart-toggle');
const charts = document.getElementById("charts");
const ticker = document.querySelector(".ticker-main");

function toggleCharts() {
    const charts = document.querySelector('#charts');
    charts.classList.toggle('collapsed');
}

// Toggle charts on toggle click
chartToggle.addEventListener('click', () => {
    toggleCharts();
});

document.addEventListener("click", function(event) {
    // Close if user clicks outside chart
    if (!charts.contains(event.target) && !chartToggle.contains(event.target) && !charts.classList.contains("collapsed")) {
        toggleCharts();
    }
    // Open if user clicks ticker
    else if (ticker.contains(event.target) && event.target.tagName != "A" && charts.classList.contains("collapsed")) {
        toggleCharts();
    }
});