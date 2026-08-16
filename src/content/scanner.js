import { debugLog } from "../utils/debugLog.js";
import { checkedVideos } from "./state.js";

function chunkArray(array, chunkSize) {
    const chunks = [];

    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(
            array.slice(i, i + chunkSize)
        );
    }

    return chunks;
}

function addIndicator(thumbnail) {
    if (thumbnail.querySelector(".like-indicator"))
        return;

    const badge = document.createElement("div");

    badge.className = "like-indicator";
    badge.textContent = "👍";

    thumbnail.appendChild(badge);
}

async function fetchRatings(videoMap) {
    const videoIds = [...videoMap.keys()];

    // Limit to 50 IDs per request per YouTube API documentation
    const chunks = chunkArray(
        videoIds,
        50
    );

    const results = [];

    for (const chunk of chunks) {
        const result = await browser.runtime.sendMessage({
            action: "getRatings",
            videoIds: chunk
        });

        if (!result?.success)
            continue;

        results.push(...result.data);
    }

    return results;
}

export async function processThumbnails(thumbnails = new Map()) {
    if (!thumbnails.size)
        return;

    const newThumbnails = new Map(
        [...thumbnails].filter(
            ([videoID]) => !checkedVideos.has(videoID)
        )
    );

    if (!newThumbnails.size)
        return;

    const ratings = await fetchRatings(
        newThumbnails
    );

    for (const item of ratings) {
        if (item.rating !== "like")
            continue;

        const thumbnail = newThumbnails.get(
            item.videoId
        );

        if (!thumbnail)
            continue;

        addIndicator(thumbnail);

        debugLog(
            "Added indicator for video:",
            item.videoId,
            thumbnail
        );
    }

    for (const videoID of newThumbnails.keys()) {
        checkedVideos.add(videoID);
    }
}