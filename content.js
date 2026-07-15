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
        queryThumbnails();
});

browser.runtime.onMessage.addListener(message => {
    if(message.action === "loginStateChanged"){
        isLoggedIn = message.loggedIn;

        if(isLoggedIn)
            queryThumbnails();
    }
});

/////////////////////////////////////////////////////////////////////////////////
// Video Tracking
/////////////////////////////////////////////////////////////////////////////////

const checkedVideos = new Set();

/////////////////////////////////////////////////////////////////////////////////
// Scanner and Logic
/////////////////////////////////////////////////////////////////////////////////

const queryThumbnails = async () => {
    if (!isLoggedIn) {
        console.log(
            "Not logged in, skipping thumbnail query"
        );
        return;
    }

    const videoMap = new Map();

    const thumbnails = document.querySelectorAll(
        `
        ytd-rich-item-renderer,
        ytd-video-renderer,
        ytd-compact-video-renderer,
        yt-lockup-view-model
        `
    );

    console.log("checkedVideos:", checkedVideos);

    thumbnails.forEach((thumbnail) => {
        const videoId = getVideoIdFromThumbnail(thumbnail);
        
        if(!videoId)
            return;
        
        if (checkedVideos.has(videoId))
            return;

        checkedVideos.add(videoId);

        videoMap.set(videoId, thumbnail);
    });
    
    if (!videoMap.size) {
        console.log("No new video IDs found");
        return;
    }

    const ratings = await fetchRatings(videoMap);

    console.log("Ratings:", ratings);

    ratings.forEach((item) => {
        if (item.rating !== "like")
            return;

        const thumbnail = videoMap.get(item.videoId);

        if (!thumbnail)
            return;

        addIndicator(thumbnail);
    })
};

/////////////////////////////////////////////////////////////////////////////////
// API Handling
/////////////////////////////////////////////////////////////////////////////////

const fetchRatings = async (videoMap) => {
    const videoIds = [...videoMap.keys()];
    const chunkedIds = chunkArray(videoIds, 50); // Limit to 50 IDs per request

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

    console.log("Final result:", results);

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
// Mutation Observer
/////////////////////////////////////////////////////////////////////////////////

let queryTimeout;

const observer =
new MutationObserver(() => {
    clearTimeout(queryTimeout);
    queryTimeout = setTimeout(() => {
        queryThumbnails();
    }, 500);
});

const app = document.querySelector("ytd-app"); // we might be able to limit further to ytd-page-manager

observer.observe(
    app,
    {
        childList:true,
        subtree:true
    }
);

