console.log("Background script loaded");

browser.runtime.onInstalled.addListener(() => {
    console.log(
        "YouTube Like Indicator installed"
    );
});

browser.runtime.onMessage.addListener(
    (message) => {
        if (message.action === "login") {
            return login().then(youtubeToken => ({
                success: youtubeToken !== null,
                youtubeToken
            }));
        }

        if (message.action === "logout") {
            console.log("Removing YouTube token");
            browser.storage.local.get("youtubeToken").then(({ youtubeToken }) => {
                console.log("Current YouTube token:", youtubeToken);
            });

            return browser.storage.local.remove("youtubeToken").then(() => ({
                success: true
            }));
        }

        if (message.action === "getRating") {
            return getRating(message.videoId).then(data => ({
                success: data !== null,
                data
            }));
        }

        if (message.action === "getRedirectURL") {
            return Promise.resolve({
                url: browser.identity.getRedirectURL(),
                id: browser.runtime.id
            });
        }
});
// browser.runtime.onMessage.addListener((message) => {
//     switch (message.action) {
//         case "login":
//             return login().then(token => ({
//                 success: true,
//                 token
//             }));

//         case "getRating":
//             return getRating(message.videoId);

//         case "getRedirectURL":
//             return Promise.resolve({
//                 url: browser.identity.getRedirectURL(),
//                 id: browser.runtime.id
//             });
//     }
// });

const login = async () => {
    const redirectUri =
        browser.identity.getRedirectURL();

    const clientId =
        "861378192930-eb7r5j25ul7jomuei2q0hh2g3kngfond.apps.googleusercontent.com";

    const authUrl =
        "https://accounts.google.com/o/oauth2/v2/auth?"
        +
        new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
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

    const youtubeToken = params.get("access_token");

    if (!youtubeToken) {
        throw new Error("No access token received");
    }

    await browser.storage.local.set({
        youtubeToken
    });

    console.log("YouTube token stored: ", youtubeToken);
    console.log("URI: ", redirectUri);

    return youtubeToken;
}

const getRating = async (videoId) => {
    const {youtubeToken} =
        await browser.storage.local.get(
            "youtubeToken"
        );

    if (!youtubeToken) {
        console.log("No YouTube token");
        return null;
    }

    // TODO: add check for response.ok and handle errors

    const response =
        await fetch(
            `https://www.googleapis.com/youtube/v3/videos/getRating?id=${videoId}`,
            {
                headers:{
                    Authorization:
                    `Bearer ${youtubeToken}`
                }
            }
        );

    // Check for 401 Unauthorized and remove token if necessary
    if (response.status === 401) {
        await browser.storage.local.remove("youtubeToken");
        return null;
    }

    if (!response.ok) {
        console.error(
            "YouTube API error:",
            response.status,
            await response.text()
        );

        return null;
    }

    return response.json();
}
