export const thumbnailSelector = `
    yt-thumbnail-view-model
`;

export const videoIDSelector = `
    a[href^="/watch?v="],
    a[href^="/shorts/"]
`;

// different dom element selectors for different types of video thumbnails on YouTube
export const thumbnailContainerSelector = `
    ytd-rich-item-renderer,
    ytd-video-renderer,
    ytd-compact-video-renderer,
    yt-lockup-view-model
`;

export const observerTargetSelector = "ytd-browse";