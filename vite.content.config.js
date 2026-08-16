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