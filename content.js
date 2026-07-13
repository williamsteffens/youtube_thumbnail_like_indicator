// Token Management
let youtubeToken = null;

browser.storage.local.get("youtubeToken").then(({ youtubeToken: storedToken }) => {
    youtubeToken = storedToken;
    // console.log("Retrieved YouTube token from storage:", youtubeToken);
});

browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.youtubeToken) {
        youtubeToken = changes.youtubeToken.newValue;
        // console.log("YouTube token updated:", youtubeToken);
    }
});

// Video Tracking
const checkedVideos = new Set();

// 

const queryThumbnails = async () => {
    if (!youtubeToken) {
        console.log(
            "No YouTube token, skipping thumbnail query"
        );
        return;
    }

    const ids = [];

    const thumbnails = document.querySelectorAll(
        `
        ytd-rich-item-renderer,
        ytd-video-renderer,
        ytd-compact-video-renderer,
        yt-lockup-view-model
        `
    );

    thumbnails.forEach((thumbnail) => {
        const videoId = getVideoIdFromThumbnail(thumbnail);
        
        if(!videoId)
            return;
        
        if (checkedVideos.has(videoId))
            return;

        checkedVideos.add(videoId);

        ids.push(videoId);
    });
    
    if (ids.length === 0) {
        console.log("No new video IDs found");
        return;
    }

    chunkedIds = chunkArray(ids, 50); // Limit to 50 IDs per request

    finalResult = [];

    for (const chunk of chunkedIds) {
        const result = await browser.runtime.sendMessage({
            action: "getRatings",
            videoIds: chunk
        });

        if (!result.success) {
            console.error("Failed to get rating");
            continue;
        }

        finalResult.push(...result.data.items);
    }

    console.log("Final result:", finalResult);

    finalResult.forEach((item) => {
        const videoId = item.videoId;
        const rating = item.rating;

        const thumbnail = Array.from(thumbnails).find(
            (thumb) => getVideoIdFromThumbnail(thumb) === videoId
        );

        if (!thumbnail)
            return;

        if (rating === "like") {
            console.log("Video is liked, adding indicator");
            addIndicator(thumbnail, videoId);
        }
    })
};


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
    const videoId = url.searchParams.get("v");

    if (videoId)
        return videoId;

    // Shorts: /shorts/VIDEO_ID
    const shortsMatch = url.pathname.match(
        /^\/shorts\/([^\/]+)/
    );

    if (shortsMatch)
        return shortsMatch[1];

    return null;
}

const addIndicator = (thumbnail, videoId) => {
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

    // checkIfLiked(videoId)
    //     .then(liked => {
        
            // badge.innerHTML =
            //     liked
            //     ? "👍 Liked"
            //     : "○ Not liked";

        // });
}

// const checkIfLiked = async (videoId) => {

//     const response =
//         await fetch(
//         `https://www.googleapis.com/youtube/v3/videos/getRating?id=${videoId}`
//         );

//     const data =
//         await response.json();

//     return (
//         data.items[0]?.rating === "like"
//     );
// }

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

// console.log("Content script loaded");
// browser.runtime.sendMessage({
//     action: "getRedirectURL"
// })
// .then(response => {
//     console.log(response)
// })
// .catch(err => {
//     console.error(err);
// });

