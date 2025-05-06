// Components
import { initDashboard } from './components/blocks/index.js';
import { initPreview } from './components/preview/index.js';
import { initTicker } from './components/ticker/index.js';

// UI
import { initAnalytics } from './ui/analytics.js';

initDashboard();
initPreview();
initTicker();
initAnalytics();

window.addEventListener("hashchange", function() {
    location.reload();
});