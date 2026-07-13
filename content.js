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

const queryThumbnails = async () => {

    const { youtubeToken } =
        await browser.storage.local.get(
            "youtubeToken"
        );

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
        if(thumbnail.dataset.checked)
            return;

        thumbnail.dataset.checked = true;

        const videoId = getVideoIdFromThumbnail(thumbnail);

        if(!videoId)
            return;

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

const observer =
new MutationObserver(
    queryThumbnails
);

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

