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

function addNewThumbnailsToPending(node) {
    const thumbnails = extractThumbnailsFromNode(node);
    let added = false;

    for (const [videoID, thumbnail] of thumbnails) {
        if (
            checkedVideos.has(videoID) ||
            pendingThumbnails.has(videoID)
        )
            continue;

        pendingThumbnails.set(videoID, thumbnail);
        added = true;
    }

    return added
}

const observer = new MutationObserver(mutations => {
    let added = false;
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE)
                continue;

            if (addNewThumbnailsToPending(node))
                added = true;
        }
    }

    if (!added)
        return;

    debugLog(
        "Pending thumbnails:",
        pendingThumbnails
    );

    // Debounce the processing of thumbnails to avoid excessive calls when many nodes are added in quick succession.
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
        }
    );

    setObserverStarted(true);
};

export function stopObserver() {
    observer.disconnect();
    setObserverStarted(false);
};