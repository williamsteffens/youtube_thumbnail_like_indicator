// Token Management
let youtubeToken = null;

browser.storage.local.get("youtubeToken").then(({ youtubeToken: storedToken }) => {
    youtubeToken = storedToken;
    console.log("Retrieved YouTube token from storage:", youtubeToken);
});

browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.youtubeToken) {
        youtubeToken = changes.youtubeToken.newValue;
        console.log("YouTube token updated:", youtubeToken);
    }
});

// Video Tracking
const checkedVideos = new Set();

// 

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

const queryThumbnails = () => {
    if (!youtubeToken) {
        console.log(
            "No YouTube token, skipping thumbnail query"
        );
        return;
    }

    const thumbnails = document.querySelectorAll(
        `
        ytd-rich-item-renderer,
        ytd-video-renderer,
        ytd-compact-video-renderer,
        yt-lockup-view-model
        `
    );

    thumbnails.forEach(async (thumbnail) => {
        const videoId = getVideoIdFromThumbnail(thumbnail);
        
        if(!videoId)
            return;
        
        if (checkedVideos.has(videoId))
            return;
        
        checkedVideos.add(videoId);


        const result = await browser.runtime.sendMessage({
            action: "getRating",
            videoId
        });

        if (!result.success) {
            console.error("Failed to get rating");
            return;
        }

        if(result.data.items[0]?.rating === "like"){
            console.log("Video is liked, adding indicator");
            addIndicator(
                thumbnail,
                videoId
            );
        }
    });
}

const addIndicator = (thumbnail, videoId) => {

    const badge =
        document.createElement(
            "div"
        );

    badge.className =
        "like-indicator";

    badge.innerHTML =
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

observer.observe(
    document.body,
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

