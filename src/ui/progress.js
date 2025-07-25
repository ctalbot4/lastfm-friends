// State
import { store } from '../state/store.js';

const progressBar = document.getElementById("progress-bar");
const usersLoaded = document.getElementById("users-loaded");
const progressText = document.getElementById("progress-text");

export function updateProgress(kind, username) {
    store.completed++;
    const progress = ((store.completed + 1) / ((store.friendCount + 1) * (store.foundTickerCache ? 1 : 4))) * 100;
    progressBar.style.width = progress + "%";
    usersLoaded.textContent = `Received ${username}'s ${kind}`;
}

export function updateProgressText() {
    if (store.isUpdatingBlocks || store.isFetchingCharts) return;
    progressText.innerHTML = `Processing data<span class="loading-dots"></span>`;
    usersLoaded.style.visibility = "hidden";
}