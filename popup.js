document
.querySelector("#login")
.addEventListener(
"click",
async () => {

    await browser.runtime.sendMessage({
        action:"login"
    });

});

document
.querySelector("#logout")
.addEventListener(
"click",
async () => {

    await browser.runtime.sendMessage({
        action:"logout"
    });

});

document
.querySelector("#log-uri")
.addEventListener(
"click",
async () => {

    await browser.runtime.sendMessage({
        action:"log-uri"
    });

});

// document
// .getElementById("login")
// .addEventListener(
// "click",
// async () => {

//     const token =
//         await browser.identity.launchWebAuthFlow({
//             interactive: true
//         });

//     console.log(
//         "Token:",
//         token
//     );

//     await chrome.storage.local.set({
//         youtubeToken: token
//     });

// });