

  function createListItem(itemData, maxPlays, isTrack = false) {
    const li = document.createElement("li");
    li.classList.add("list-item");
    li.innerHTML = 
        `<div class="bar" style="width: ${15 + (itemData.plays / maxPlays) * 85}%;"></div>
            <img class="item-image${isTrack ? ' removed"' : ` " src="${itemData.image}"`}>
            <div class="item-info"${isTrack ? ' style="padding-left: 16px"' : ""}>
              <div class="item-name">${itemData.name}</div>
              <div class="item-subtext">
                <span class="artist-subtext${isTrack ? "" : " removed"}">${isTrack ? `${itemData.artist}` : ""}</span>
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
      if (i == 2 && count > 3) {
        span.innerHTML = `+${count - 2}`;
        span.classList.add("others");
        li.querySelector(".listeners").appendChild(span);
        imgIndex--;
        continue;
      }
      else if (i + 1 > count) {
        continue;
      }
      const listener = itemData.listeners[i];
      span.dataset.user = listener.user;
      span.dataset.plays = listener.plays;

      span.innerHTML = `<img class="listener-img" src="${listener.img}">`;
      li.querySelector(".listeners").appendChild(span);
      imgIndex--;
    }
    // itemData.listeners.forEach((listener, index, array) => {

    //   const span = document.createElement("span");
    //   span.classList.add("listener-container");
    //   span.dataset.user = listener.user;
    //   span.dataset.plays = listener.plays;
    //   span.style.left = `${index * 18}px`;
    //   span.style.zIndex = index;

    //   if (index == 2 && array.length > 3) {
    //     span.innerHTML = `+${array.length - 2}`;
    //     span.classList.add("others");
    //     li.querySelector(".listeners").appendChild(span);
    //   }
    //   else if (index < 3) {
    //     span.innerHTML = `<img class="listener-img" src="${listener.img}">`;
    //     li.querySelector(".listeners").appendChild(span);
    //   }
    //   else {
    //     // Nothing
    //   }
    // });


    return li;
  }