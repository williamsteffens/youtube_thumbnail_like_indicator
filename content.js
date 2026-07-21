/////////////////////////////////////////////////////////////////////////////////
// Debug
// /////////////////////////////////////////////////////////////////////////////////
const DEBUG = true;

const debugLog = (...args) => {
    if (DEBUG)
        console.log(
            // new Date().toISOString(),
            "[YT Like Indicator Ext]",
            ...args
        );
}

/////////////////////////////////////////////////////////////////////////////////
// Login State Change Handling
/////////////////////////////////////////////////////////////////////////////////

let isLoggedIn = false;

browser.runtime.sendMessage({
    action:"isLoggedIn"
})
.then(response => {
    isLoggedIn = response.success;

    if(isLoggedIn)
        processThumbnails(
            [...document.querySelectorAll(selector)]
        );
});

browser.runtime.onMessage.addListener(message => {
    if(message.action === "loginStateChanged"){
        isLoggedIn = message.loggedIn;

        if(isLoggedIn)
            processThumbnails(
                [...document.querySelectorAll(selector)]
            );
    }
});

/////////////////////////////////////////////////////////////////////////////////
// Checked Video Tracking
/////////////////////////////////////////////////////////////////////////////////

const checkedVideos = new Set();

/////////////////////////////////////////////////////////////////////////////////
// Scanner and Logic
/////////////////////////////////////////////////////////////////////////////////

const processThumbnails = async (thumbnails = []) => {
    if (!thumbnails.length)
        return;

    const videoMap = new Map();

    thumbnails.forEach((thumbnail) => {
        const videoId = getVideoIdFromThumbnail(thumbnail);
        
        if(!videoId)
            return;
        
        if (checkedVideos.has(videoId))
            return;

        checkedVideos.add(videoId);

        videoMap.set(videoId, thumbnail);
    });
    
    if (!videoMap.size)
        return;

    const ratings = await fetchRatings(videoMap);

    ratings.forEach((item) => {
        if (item.rating !== "like")
            return;

        const thumbnail = videoMap.get(item.videoId);

        if (!thumbnail)
            return;

        addIndicator(thumbnail);

        debugLog(
            "Added indicator for video: ", item.videoId, thumbnail 
        );
    })
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
    const badge =
        document.createElement(
            "div"
        );

    badge.className =
        "like-indicator";

    badge.textContent =
        "👍";

    thumbnail
        .querySelector("yt-thumbnail-view-model")
        ?.appendChild(badge);
}

/////////////////////////////////////////////////////////////////////////////////
// Mutation Observer - Watches for changes in the DOM to process new thumbnails
/////////////////////////////////////////////////////////////////////////////////

let queryTimeout;
let pendingThumbnails = new Set();

const selector = `
    ytd-rich-item-renderer,
    ytd-video-renderer,
    ytd-compact-video-renderer,
    yt-lockup-view-model
`;

const observer = new MutationObserver(mutations => {
    if (!isLoggedIn)
        return;

    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE)
                continue;

            // this should do a querty to make sure that no other of the elements 
            // are already in the set, but for now we will just add them all and 
            // let the set handle duplicates

            if (node.matches(selector))
                pendingThumbnails.add(node);
        }
    }

    clearTimeout(queryTimeout);

    queryTimeout = setTimeout(() => {
        debugLog("Mutation observed, processing thumbnails...");
        
        const thumbnails = [...pendingThumbnails];
        debugLog(thumbnails);
        pendingThumbnails.clear();
        processThumbnails(thumbnails);
    }, 500);
});

const app = document.querySelector("ytd-app"); // we might be able to limit further to ytd-page-manager

observer.observe(
    app, {
        childList:true,
        subtree:true,
        attributes: true,
        attributeFilter: ["style","src"]
    }
);
