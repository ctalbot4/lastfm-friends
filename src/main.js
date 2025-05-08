// Components
import { initDashboard } from './components/blocks/index.js';
import { initPreview } from './components/preview/index.js';
import { initTicker } from './components/ticker/index.js';

import { updateTicker } from './components/ticker/update.js';
import { updateAllBlocks } from './components/blocks/update.js';

// UI
import { initAnalytics } from './ui/analytics.js';

window.updateTicker = updateTicker;
window.updateAllBlocks = updateAllBlocks;

initDashboard();
initPreview();
initTicker();
initAnalytics();

window.addEventListener("hashchange", function() {
    location.reload();
});