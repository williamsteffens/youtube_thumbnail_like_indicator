import { defineConfig } from "vite";
import { resolve } from "path";

/*
Vite is a little weird with the output of the html file, so we need 
set the rootdir and public dir manually as well as the outdir.
Another possible solution might be to use @samrum/vite-plugin-web-extension
*/

export default defineConfig({
    root: resolve(import.meta.dirname, "src"),
    publicDir: resolve(import.meta.dirname, "public"),
    build: {
        outDir: resolve(import.meta.dirname, "dist"),
        emptyOutDir: true,

        rollupOptions: {
            input: {
                content: resolve(
                    import.meta.dirname,
                    "src/content/index.js"
                ),

                background: resolve(
                    import.meta.dirname,
                    "src/background/index.js"
                ),

                popup: resolve(
                    import.meta.dirname,
                    "src/popup/index.html"
                )
            },

            output: {
                entryFileNames: (chunk) => {
                    if (chunk.name == "popup") {
                        return "popup/index.js";
                    }
                    return "[name].js";
                },
                chunkFileNames: "chunks/[name].js",
                assetFileNames: "assets/[name][extname]"
            }
        }
    },

    // potential solution to the html file output problem, but it doesn't work

    // plugins: [
    //     {
    //         name: "move-popup-html",
    //         generateBundle(_options, bundle) {
    //             if (existsSync(resolve(import.meta.dirname, "dist/popup/index.html"))) {
    //                 renameSync(
    //                     resolve(import.meta.dirname, "dist/popup/index.html"),
    //                     resolve(import.meta.dirname, "dist/popup.html")
    //                 );
    //             }
    //         },
    //     }
    // ]
});