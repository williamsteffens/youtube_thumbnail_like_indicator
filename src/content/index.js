import { debugLog } from "../util/debugLog.js";

/////////////////////////////////////////////////////////////////////////////////
// Login State Change Handling
/////////////////////////////////////////////////////////////////////////////////

let isLoggedIn = false;

browser.runtime.onMessage.addListener(async (message) => {
    if(message.action !== "loginStateChanged")
        return;

    isLoggedIn = message.loggedIn;

    if(isLoggedIn) {
        processThumbnails(
            extractThumbnailsFromNode(document)
        );
        await startObserver();
    }
    else if (observerStarted) {
        observer.disconnect();
        observerStarted = false;
    }
});

/////////////////////////////////////////////////////////////////////////////////
// Checked Video Tracking
/////////////////////////////////////////////////////////////////////////////////

const checkedVideos = new Set();

/////////////////////////////////////////////////////////////////////////////////
// Scanner and Logic
/////////////////////////////////////////////////////////////////////////////////

const processThumbnails = async (thumbnails = new Map()) => {
    if (!thumbnails.size)
        return;

    const newThumbnails = new Map(
        [...thumbnails].filter(([videoID]) => !checkedVideos.has(videoID))
    );
    
    if (!newThumbnails.size)
        return;

    const ratings = await fetchRatings(newThumbnails);

    ratings.forEach((item) => {
        if (item.rating !== "like")
            return;

        const thumbnail = newThumbnails.get(item.videoId);

        if (!thumbnail)
            return;

        addIndicator(thumbnail);

        debugLog(
            "Added indicator for video: ", item.videoId, thumbnail 
        );
    })

    for (const videoID of newThumbnails.keys())
        checkedVideos.add(videoID);
};

/////////////////////////////////////////////////////////////////////////////////
// API Handling
/////////////////////////////////////////////////////////////////////////////////

const fetchRatings = async (videoMap) => {
    const videoIds = [...videoMap.keys()];
    const chunkedIds = chunkArray(videoIds, 50); // Limit to 50 IDs per request per YouTube API documentation

    const results = [];

    for (const chunk of chunkedIds) {
        const result = await browser.runtime.sendMessage({
            action: "getRatings",
            videoIds: chunk
        });

        if (!result.success)
            continue;

        results.push(...result.data);
    }

    return results;
}

/////////////////////////////////////////////////////////////////////////////////
// Helpers
/////////////////////////////////////////////////////////////////////////////////

const chunkArray = (array, chunkSize) => {
    const chunks = [];

    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }

    return chunks;
}

const getVideoIdFromThumbnail = (thumbnail) => {
    const link = thumbnail.querySelector(
        'a[href^="/watch?v="], a[href^="/shorts/"]'
    );

    if(!link)
        return null;

    const url = new URL(
        link.href
    );

    // Normal video: /watch?v=VIDEO_ID
    // const videoId = url.searchParams.get("v");

    // if (videoId)
    //     return videoId;

    // // Shorts: /shorts/VIDEO_ID
    // const shortsMatch = url.pathname.match(
    //     /^\/shorts\/([^\/]+)/
    // );

    // if (shortsMatch)
    //     return shortsMatch[1];

    // return null;

    return url.searchParams.get("v") || url.pathname.split("/").pop();
}

const addIndicator = (thumbnail) => {
    if (thumbnail.querySelector(".like-indicator"))
        return;

    const badge =
        document.createElement(
            "div"
        );

    badge.className =
        "like-indicator";

    badge.textContent =
        "👍";

    thumbnail?.appendChild(badge);
}

const extractThumbnailsFromNode = (node) => {
    const thumbnails = new Map();
    const elements = []

    elements.push(
        ...node.querySelectorAll(videoIDSelector)
    );

    for (const element of elements) {
        const href = element.href;
        if (!href)
            continue;

        const url = new URL(href);
        const videoID = url.searchParams.get("v") || url.pathname.split("/").pop();

        if (!videoID)
            continue;

        const thumbnail = element.querySelector(thumbnailSelector);
        if (thumbnail)
            thumbnails.set(videoID, thumbnail);
    }
    
    return thumbnails;
}

function waitForElement(selector) {
    return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }

        const observer = new MutationObserver((mutations) => {
            const element = document.querySelector(selector);
            if (element) {
                observer.disconnect();
                resolve(element);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

/////////////////////////////////////////////////////////////////////////////////
// Mutation Observer - Watches for changes in the DOM to process new thumbnails
/////////////////////////////////////////////////////////////////////////////////

let queryTimeout;
let pendingThumbnails = new Map();

// different dom element selectors for different types of video thumbnails on YouTube
const selector = `
    ytd-rich-item-renderer,
    ytd-video-renderer,
    ytd-compact-video-renderer,
    yt-lockup-view-model
`;

const thumbnailSelector = `
    yt-thumbnail-view-model
`;

const videoIDSelector = `
    a[href^="/watch?v="],
    a[href^="/shorts/"]
`;

const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE)
                continue;

            const thumbnails = extractThumbnailsFromNode(node);
            
            for (const [videoID, thumbnail] of thumbnails)
                if (!checkedVideos.has(videoID) && !pendingThumbnails.has(videoID))
                    pendingThumbnails.set(videoID, thumbnail);
        }
    }

    debugLog("Pending thumbnails:", pendingThumbnails);

    clearTimeout(queryTimeout);

    queryTimeout = setTimeout(() => {
        const thumbnails = new Map(pendingThumbnails);
        pendingThumbnails.clear();
        processThumbnails(thumbnails);
    }, 500);
});

let observerStarted = false;

const startObserver = async () => {
    if (observerStarted)
        return;

    const target = await waitForElement("ytd-browse");
    debugLog("Starting observer on target:", target);
    if (!target)
        return;

    observer.observe(
        target, {
            childList:true,
            subtree:true,
            attributes: true,
            attributeFilter: ["style","src"]
        }
    );

    observerStarted = true;
}

const initialize = async () => {
    if (document.readyState === "loading") {
        await new Promise(resolve => {
            document.addEventListener("DOMContentLoaded", resolve, { once: true });
        });
    }

    const repsonse = await browser.runtime.sendMessage({
        action: "isLoggedIn"
    });

    debugLog("Login state:", repsonse);

    isLoggedIn = repsonse.success;
    if (!isLoggedIn)
        return;

    processThumbnails(
        extractThumbnailsFromNode(document)
    );

    await startObserver();
}

initialize();
