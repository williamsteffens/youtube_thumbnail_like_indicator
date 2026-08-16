const DEBUG = true;

export const debugLog = (...args) => {
    if (DEBUG)
        console.log(
            // new Date().toISOString(),
            "[YT Like Indicator Ext]",
            ...args
        );
};