import * as selectors from "./selectors.js";

export function getVideoIdFromUrl(url) {
    return (
        url.searchParams.get("v") ||
        url.pathname.split("/").pop()
    );
}

export function getVideoIdFromThumbnail(thumbnail) {
    const link = thumbnail.querySelector(
        selectors.videoIDSelector
    );

    if (!link)
        return null;

    return getVideoIdFromUrl(
        new URL(link.href)
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
}

export function extractThumbnailsFromNode(node) {
    const thumbnails = new Map();

    const elements = node.querySelectorAll(
        selectors.videoIDSelector
    );

    for (const element of elements) {
        const href = element.href;

        if (!href)
            continue;

        const videoID = getVideoIdFromUrl(
            new URL(href)
        );

        if (!videoID)
            continue;

        const thumbnail = element.querySelector(
            selectors.thumbnailSelector
        );

        if (thumbnail)
            thumbnails.set(videoID, thumbnail);
    }

    return thumbnails;
}