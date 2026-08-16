import { debugLog } from "../utils/debugLog.js";
import {
    setLoggedIn
} from "./state.js";
import {
    startObserver,
    stopObserver
} from "./observer.js";
import {
    extractThumbnailsFromNode
} from "./youtube.js";
import { processThumbnails } from "./thumbnail_processor.js";

export const initializeLoginHandling = () => {
    browser.runtime.onMessage.addListener(
        async (message) => {
            if (message.action !== "loginStateChanged")
                return;

            setLoggedIn(message.loggedIn);

            debugLog(
                "Login state changed:",
                message.loggedIn
            );

            if (!message.loggedIn) {
                stopObserver();
                return;
            }

            const thumbnails = extractThumbnailsFromNode(document);
            await processThumbnails(thumbnails);
            await startObserver();
        }
    );
};