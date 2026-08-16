/**
 * @file vite.content.config.js
 * @description Vite configuration for building the content script. Workaround for Vite's lack of support for building with codeSplitting with multiple entry points.
 */

import { defineConfig } from "vite";
import { resolve } from "path";

const root = import.meta.dirname
const src = resolve(root, "src");

export default defineConfig({
    root: src,
    publicDir: resolve(root, "public"),
    envDir: root,

    build: {
        outDir: resolve(root, "dist"),
        emptyOutDir: false,

        rollupOptions: {
            input: resolve(src, "content/index.js"),

            output: {
                entryFileNames: "content.js",
                codeSplitting: false,
            },
        },
    },
});