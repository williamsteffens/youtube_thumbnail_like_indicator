console.log("Background script loaded");

browser.runtime.onInstalled.addListener(() => {
    console.log(
        "YouTube Thumbnail Like Indicator installed"
    );
});

/////////////////////////////////////////////////////////////////////////////////
// Login State Management
/////////////////////////////////////////////////////////////////////////////////

const client_id = "861378192930-jp8g45a3bt489p31cq4hiokdnuo64f4g.apps.googleusercontent.com";
const client_secret = process.env.GOOGLE_OAUTH2_SECRET; // Note: In a real-world scenario, you should not expose client secrets in client-side code. This is for demonstration purposes only.
const redirect_uri = browser.identity.getRedirectURL();

let youtubeToken = null;
let refreshToken = null;
let tokenExpiresAt = 0;

let authInFlight = null;

const storageReady = browser.storage.local.get([
    "youtubeToken",
    "refreshToken",
    "expiresAt"
]).then(data => {
    youtubeToken = data.youtubeToken ?? null;
    refreshToken = data.refreshToken ?? null;
    tokenExpiresAt = data.expiresAt ?? 0;
});

browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local")
        return;

    if (changes.youtubeToken)
        youtubeToken = changes.youtubeToken.newValue ?? null;
    if (changes.refreshToken)
        refreshToken = changes.refreshToken.newValue ?? null;
    if (changes.expiresAt)
        tokenExpiresAt = changes.expiresAt.newValue ?? 0;
});

const isTokenExpired = () => Date.now() >= (tokenExpiresAt - 30_000); // Consider token expired if less than 30 seconds left


/////////////////////////////////////////////////////////////////////////////////
// Message Handling
/////////////////////////////////////////////////////////////////////////////////

browser.runtime.onMessage.addListener(async (message) => {
    switch (message.action) {
        case "login":
            await storageReady; // Ensure we have the latest token info before proceeding
            try {
                const token = await ensureLoggedIn(true);
                return {
                    success: !!token,
                    youtubeToken: token
                };
            } catch (error) {
                console.error("Login failed:", error);
                return {
                    success: false,
                    error: error.message
                };
            }

        case "logout":
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
            await storageReady; // Ensure we have the latest token info before proceeding
            const token = await ensureLoggedIn(false);
            if (!token) {
                return {
                    success: false,
                    error: "NO_TOKEN"
                };
            }

            const result = await getRatings(message.videoIds)

            if (!result.success && (result.error === "TOKEN_EXPIRED" || result.error === "UNAUTHORIZED")) {
                const refreshedToken = await refreshAccessToken();
                if (!refreshedToken) {
                    await logout();
                    return {
                        success: false,
                        error: "TOKEN_REFRESH_FAILED"
                    };
                }

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
// OAuth (Auth Code + PKCE + Refresh)
/////////////////////////////////////////////////////////////////////////////////

const ensureLoggedIn = async (interactive) => {
    if (authInFlight) {
        console.log("Auth already in progress, waiting for result...");
        return authInFlight;
    }

    return authInFlight = authenticate(interactive).finally(() => {
        authInFlight = null;
    });
}

const authenticate = async (interactive) => {
    if (youtubeToken && !isTokenExpired())
        return youtubeToken;

    // try to refresh the token if we have a refreshtoken
    if (refreshToken) {
        const refreshedToken = await refreshAccessToken();
        if (refreshedToken)
            return refreshedToken;
    }

    if (!interactive)
        return null;

    return loginWithPkce();
}

const loginWithPkce = async () => {
    const { codeVerifier, codeChallenge } = await createPkcePair();
    const state = randomString(24);

    const authUrl =
        "https://accounts.google.com/o/oauth2/v2/auth?"
        +
        new URLSearchParams({
            client_id,
            redirect_uri,
            response_type: "code",
            scope: [
                "https://www.googleapis.com/auth/youtube.force-ssl",
                "openid",
                "profile",
            ].join(" "),
            access_type: "offline",
            include_granted_scopes: "true",
            prompt: "consent",
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
            state
        });

    const responseUrl =
        await browser.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: true
        });

    const url = new URL(responseUrl);
    const returnedState = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error)
        throw new Error(`Login failed: ${error}`);
    if (!code)
        throw new Error("No code returned from login flow");
    if (returnedState !== state)
        throw new Error("State mismatch in login flow");

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id,
            client_secret,
            code,
            code_verifier: codeVerifier,
            grant_type: "authorization_code",
            redirect_uri
        })
    });

    if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("Token exchange failed:", tokenResponse.status, errorText);
        throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();

    const youtubeToken = tokenData.access_token ?? null;
    const refreshToken = tokenData.refresh_token ?? refreshToken ?? null;
    const tokenExpiresAt = tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : 0;

    await browser.storage.local.set({
        youtubeToken,
        refreshToken,
        expiresAt: tokenExpiresAt
    });

    notifyYouTubeTabsofLoginStateChange(true);
    return youtubeToken;
}

const refreshAccessToken = async () => {
    if (!refreshToken)
        return false;

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id,
            client_secret,
            refresh_token: refreshToken,
            grant_type: "refresh_token"
        })
    });

    if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("Token refresh failed:", tokenResponse.status, errorText);
        return false;
    }

    const tokenData = await tokenResponse.json();

    const youtubeToken = tokenData.access_token ?? null;
    const tokenExpiresAt = tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : 0;

    await browser.storage.local.set({
        youtubeToken,
        expiresAt: tokenExpiresAt
    });

    return !!youtubeToken;
}

const logout = async () => {
    youtubeToken = null;
    refreshToken = null;
    tokenExpiresAt = 0;

    await browser.storage.local.remove([
        "youtubeToken",
        "refreshToken",
        "expiresAt"
    ]);

    notifyYouTubeTabsofLoginStateChange(false);
}

const notifyYouTubeTabsofLoginStateChange = (loggedIn) => {
    browser.tabs.query({
        url: "*://*.youtube.com/*"
    }).then(tabs => {
        tabs.forEach(tab => {
            browser.tabs.sendMessage(
                tab.id,
                {
                    action: "loginStateChanged",
                    loggedIn
                }
            )
                .catch(() => {
                    // Ignore tabs without content script loaded
                });
        });
    });
}

/////////////////////////////////////////////////////////////////////////////////
// PKCE Helpers
/////////////////////////////////////////////////////////////////////////////////

const base64UrlEncode = (bytes) => {
    let binary = "";
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const randomString = (length = 64) => {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return base64UrlEncode(bytes).slice(0, length);
};

const sha256 = async (input) => {
    const data = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return new Uint8Array(digest);
}

const createPkcePair = async () => {
    const codeVerifier = randomString(96); // 43-128 chars allowed

    // store the codeVerifier in memory for later use during token exchange
    // browser.storage.local.set({ pcke_verifier: codeVerifier });

    const digest = await sha256(codeVerifier);
    const codeChallenge = base64UrlEncode(digest);
    return { codeVerifier, codeChallenge };
}


/////////////////////////////////////////////////////////////////////////////////
// YouTube API
/////////////////////////////////////////////////////////////////////////////////

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

    if (!missingIds.length) {
        return {
            success: true,
            data: results
        };
    }

    const response =
        await fetch(
            `https://www.googleapis.com/youtube/v3/videos/getRating?id=${missingIds.join(",")}&fields=items`, {
            method: "GET",
            headers: {
                Authorization:
                    `Bearer ${youtubeToken}`,
                Accept: "application/json"
            }
        }
        );

    // Check for 401 Unauthorized and remove token if necessary
    if (response.status === 401) {
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
    data.items?.forEach(item => {
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
