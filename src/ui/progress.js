// State
import { store } from '../state/store.js';

const progressBar = document.getElementById("progress-bar");
const usersLoaded = document.getElementById("users-loaded");
const progressText = document.getElementById("progress-text");

export function updateProgress(kind, username) {
    store.completed++;
    const progress = ((store.completed) / ((store.friendCount) * 2)) * 100;
    progressBar.style.width = progress + "%";
    usersLoaded.textContent = `Received ${username}'s ${kind}`;
}

// Counter hits two when both blocks and listening are done
let ready = 0;
export function updateProgressText() {
    ready++;
    if (ready === 2) {
        progressText.innerHTML = `Processing data<span class="loading-dots"></span>`;
        usersLoaded.style.visibility = "hidden";
    }
}