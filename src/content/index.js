import { debugLog } from "../utils/debugLog.js";
import { 
    getLoggedIn, 
    setLoggedIn,  
} from "./state.js";
import { initializeLoginHandling } from "./login.js";
import { startObserver } from "./observer.js";
import { processThumbnails } from "./scanner.js";
import { extractThumbnailsFromNode } from "./youtube.js";

async function initialize() {
    if (document.readyState === "loading") {
        await new Promise(resolve => {
            document.addEventListener("DOMContentLoaded", resolve, { once: true });
        });
    }

    initializeLoginHandling();

    const repsonse = await browser.runtime.sendMessage({
        action: "isLoggedIn"
    });

    debugLog(
        "Login state:", 
        repsonse
    );

    const loggedIn = repsonse?.success;
    setLoggedIn(loggedIn);
    if (!loggedIn)
        return;

    await processThumbnails(
        extractThumbnailsFromNode(document)
    );

    await startObserver();
}

initialize();
