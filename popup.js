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