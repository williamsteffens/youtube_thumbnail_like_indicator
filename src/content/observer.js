import { debugLog } from "../utils/debugLog.js";
import {
    checkedVideos,
    getObserverStarted,
    setObserverStarted
} from "./state.js";
import { processThumbnails } from "./thumbnail_processor.js";
import { extractThumbnailsFromNode } from "./youtube.js";
import * as selector from "./selectors.js";

let queryTimeout;
const pendingThumbnails = new Map();

const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE)
                continue;

            const thumbnails = extractThumbnailsFromNode(node);

            for (const [videoID, thumbnail] of thumbnails) {
                if (
                    checkedVideos.has(videoID) ||
                    pendingThumbnails.has(videoID)
                )
                    continue;

                pendingThumbnails.set(videoID, thumbnail);
            }
        }
    }

    debugLog(
        "Pending thumbnails:",
        pendingThumbnails
    );

    clearTimeout(queryTimeout);

    queryTimeout = setTimeout(() => {
        const thumbnails = new Map(pendingThumbnails);
        pendingThumbnails.clear();
        processThumbnails(thumbnails);
    }, 500);
});

function waitForElement(selector) {
    return new Promise((resolve) => {
        const element = document.querySelector(selector);

        if (element) {
            resolve(element);
            return;
        }

        const observer =
            new MutationObserver(() => {
                const element = document.querySelector(selector);

                if (!element)
                    return;

                observer.disconnect();
                resolve(element);
            });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

export async function startObserver() {
    if (getObserverStarted())
        return;

    const target = await waitForElement(
        selector.observerTargetSelector
    );

    debugLog(
        "Starting observer on target:",
        target
    );

    if (!target)
        return;

    observer.observe(
        target, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: [
                "style",
                "src"
            ]
    });

    setObserverStarted(true);
};

export function stopObserver() {
    observer.disconnect();
    setObserverStarted(false);
};