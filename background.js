console.log("Background script loaded");

browser.runtime.onInstalled.addListener(() => {
    console.log(
        "YouTube Like Indicator installed"
    );
});

/////////////////////////////////////////////////////////////////////////////////
// Login State Management
/////////////////////////////////////////////////////////////////////////////////

const client_id = "861378192930-jp8g45a3bt489p31cq4hiokdnuo64f4g.apps.googleusercontent.com";
const redirect_uri = browser.identity.getRedirectURL();

let youtubeToken = null;
let tokenExpiresAt = 0;

browser.storage.local.get([
    "youtubeToken",
    "expiresAt"
]).then(data => {
    youtubeToken = data.youtubeToken;
    tokenExpiresAt = data.expiresAt ?? 0;
});

browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.youtubeToken)
        youtubeToken = changes.youtubeToken.newValue;
    if (area === "local" && changes.expiresAt)
        tokenExpiresAt = changes.expiresAt.newValue;
});

const isTokenExpired = () => {
    return Date.now() >= tokenExpiresAt;
}

/////////////////////////////////////////////////////////////////////////////////
// Message Handling
/////////////////////////////////////////////////////////////////////////////////

browser.runtime.onMessage.addListener(async (message) => {
    switch (message.action) {
        case "login":
            return login().then(newYoutubeToken => ({
                success: newYoutubeToken !== null,
                newYoutubeToken
            }));

        case "logout":
            console.log("Removing YouTube token");

            await logout();
            
            return {
                success: true
            };

        case "isLoggedIn":
            return {
                success: !!youtubeToken && !isTokenExpired()
            };

        case "log-uri":
            console.log(
                "Current URI:",
                browser.identity.getRedirectURL()
            );

            return {
                success: true
            };

        case "getRatings":
            const result = await getRatings(message.videoIds)

            if (!result.success) {
                console.error("Failed to get ratings:", result.error);

                if (result.error === "TOKEN_EXPIRED")
                    await logout();
            }

            return result;

        case "getRedirectURL":
            return {
                url: browser.identity.getRedirectURL(),
                id: browser.runtime.id
            };

        default:
            console.warn(
                "Unknown message action:",
                message.action
            );

            return {
                success: false,
                error: "Unknown action"
            };
    }
});

/////////////////////////////////////////////////////////////////////////////////
// Cache
/////////////////////////////////////////////////////////////////////////////////

const ratingCache = new Map();
const CACHE_EXPIRATION_TIME = 10 * 60 * 1000; // 10 minutes

/////////////////////////////////////////////////////////////////////////////////
// Login and YouTube API Functions
/////////////////////////////////////////////////////////////////////////////////

const login = async () => {
    const authUrl =
        "https://accounts.google.com/o/oauth2/v2/auth?"
        +
        new URLSearchParams({
            client_id,
            redirect_uri,
            response_type: "token",
            scope: "https://www.googleapis.com/auth/youtube.force-ssl",
            prompt: "consent"
        });

    const responseUrl =
        await browser.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: true
        });

    const params = new URLSearchParams(
        new URL(responseUrl).hash.substring(1)
    );

    const newYoutubeToken = params.get("access_token");

    if (!newYoutubeToken) {
        throw new Error("No access token received");
    }

    await browser.storage.local.set({
        youtubeToken: newYoutubeToken,
        expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
    });

    // Notify all open YouTube tabs
    browser.tabs.query({
        url:"*://*.youtube.com/*"
    }).then(tabs => {
        tabs.forEach(tab => {
            browser.tabs.sendMessage(
                tab.id,
                {
                    action:"loginStateChanged",
                    loggedIn:true
                }
            )
            .catch(() => {
                // Ignore tabs without content script loaded
            });
        });
    });

    console.log("YouTube token stored: ", newYoutubeToken);
    console.log("URI: ", redirect_uri);

    return newYoutubeToken;
}

const logout = async () => {
    youtubeToken = null;
    tokenExpiresAt = 0;

    await browser.storage.local.remove([
        "youtubeToken",
        "expiresAt"
    ]);
}

const getRatings = async (videoIds) => {
    if (!youtubeToken) {
        console.log("No valid YouTube token available");
        return {
            success: false,
            error: "NO_TOKEN"
        };
    }

    if (isTokenExpired()) {
        console.log("YouTube token has expired");
        return {
            success: false,
            error: "TOKEN_EXPIRED"
        };
    }

    const results = [];
    const missingIds = [];

    // Check cache first
    for (const videoId of videoIds) {
        const cached = ratingCache.get(videoId);

        if (cached && (Date.now() - cached.timestamp < CACHE_EXPIRATION_TIME)) {
            results.push({
                videoId,
                rating: cached.rating
            });
        } 
        else {
            missingIds.push(videoId);
        }
    }

    if (missingIds.length === 0) {
        return {
            success: true,
            data: results
        };
    }

    const response =
        await fetch(
            `https://www.googleapis.com/youtube/v3/videos/getRating?id=${missingIds.join(",")}&fields=items`, {
                method: "GET",
                headers:{
                    Authorization:
                    `Bearer ${youtubeToken}`,
                    Accept: "application/json"
                }
            }
        );

    // Check for 401 Unauthorized and remove token if necessary
    if (response.status === 401) {
        await browser.storage.local.remove("youtubeToken");
        return {
            success: false,
            error: "UNAUTHORIZED"
        };
    }

    if (!response.ok) {
        console.error(
            "YouTube API error:",
            response.status,
            await response.text()
        );

        return {
            success: false,
            error: "API_ERROR"
        };
    }

    const data = await response.json();

    // Update cache with new ratings
    data.items.forEach(item => {
        ratingCache.set(item.videoId, {
            rating: item.rating,
            timestamp: Date.now()
        });

        results.push({
            videoId: item.videoId,
            rating: item.rating
        });
    });

    return {
        success: true,
        data: results
    };
}
