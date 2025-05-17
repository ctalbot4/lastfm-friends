// State
import { store } from '../state/store.js';

const progressBar = document.getElementById("progress-bar");

export function updateProgress() {
    store.completed++;
    const progress = ((store.completed + 1) / ((store.friendCount + 1) * (store.foundTickerCache ? 1 : 4))) * 100;
    progressBar.style.width = progress + "%";
}