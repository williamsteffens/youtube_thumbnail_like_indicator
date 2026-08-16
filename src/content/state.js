export const checkedVideos = new Set();

let isLoggedIn = false;

export function getLoggedIn() {
    return isLoggedIn;
}
export function setLoggedIn(value) {
    isLoggedIn = value;
}

let observerStarted = false;
    
export function getObserverStarted() {
    return observerStarted;
}
export function setObserverStarted(value) {
    observerStarted = value;
}