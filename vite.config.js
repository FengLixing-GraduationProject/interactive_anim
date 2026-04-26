import { defineConfig } from "vite";
import electron from "vite-plugin-electron/simple";

export default defineConfig({
    plugins: [
        electron({
            main: {
                entry: "electron/main.js"
            }
        })
    ],
    base: "./"
});