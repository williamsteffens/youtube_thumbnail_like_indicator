console.log("Background script loaded");

let youtubeToken = null;

browser.storage.local.get("youtubeToken").then(({ youtubeToken: storedToken }) => {
    youtubeToken = storedToken;
});

browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.youtubeToken)
        youtubeToken = changes.youtubeToken.newValue;
});

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

        if (message.action === "isLoggedIn") {
            return Promise.resolve({ success: !!youtubeToken });
        }

        if (message.action === "log-uri") {
            console.log("Current URI:", browser.identity.getRedirectURL());
            return Promise.resolve({ success: true });
        }

        if (message.action === "getRatings") {
            return getRatings(message.videoIds).then(data => ({
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

//         case "getRatings":
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
        "861378192930-b880dkjvbgvm4eih4074tn0lrmku58mu.apps.googleusercontent.com";

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

    console.log("YouTube token stored: ", youtubeToken);
    console.log("URI: ", redirectUri);

    return youtubeToken;
}

const getRatings = async (videoIds) => {
    if (!youtubeToken) {
        console.log("No YouTube token");
        return null;
    }

    const response =
        await fetch(
            `https://www.googleapis.com/youtube/v3/videos/getRating?id=${videoIds.join(",")}&fields=items`, {
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
