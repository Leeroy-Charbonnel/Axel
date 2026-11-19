import { defineConfig, loadEnv, type Plugin } from "vite"
import vue from "@vitejs/plugin-vue"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

//SPLIT PROXY - /api and /media can target different upstreams. Common
//case: run the local Express for auth (Google OAuth needs the callback
//to come back to localhost) but pull /media from prod's volume so the
//browser sees the real images + .glb files.
//
//  VITE_API_BASE_URL    - default upstream for both, e.g. "https://prod"
//  VITE_MEDIA_BASE_URL  - optional override for /media only
//
//Unset both = everything goes to the local Express at :3001.
//
//xfwd on /api: the request reaches Express from 127.0.0.1, x-forwarded-for and
//x-forwarded-host still name the real client for server/dev-login.ts.

//THE TEXT FONT, asked for in the HTML: without the hint the browser finds it
//only once the stylesheet has arrived, and the text waits one more round trip.
//Latin only, the subset every page draws.
const TEXT_FONT = /^assets\/montserrat-latin-wght-normal-[\w-]+\.woff2$/

function preloadTextFont(base: string): Plugin {
  return {
    name: "preload-text-font",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        const font = Object.keys(ctx.bundle ?? {}).find((name) => TEXT_FONT.test(name))
        if (!font) throw new Error("[vite] the build holds no latin Montserrat file to preload")
        return [{
          tag: "link",
          attrs: { rel: "preload", as: "font", type: "font/woff2", href: `${base}${font}`, crossorigin: true },
          injectTo: "head",
        }]
      },
    },
  }
}

export default defineConfig(({ mode, command }) => {
  const env  = loadEnv(mode, process.cwd(), "")
  const base = env.VITE_BASE_PATH || "/"
  const apiTarget   = (env.VITE_API_BASE_URL   || "http://localhost:3001").replace(/\/$/, "")
  const mediaTarget = (env.VITE_MEDIA_BASE_URL || env.VITE_API_BASE_URL || "http://localhost:3001").replace(/\/$/, "")
  console.log(`[vite] /api   -> ${apiTarget}`)
  console.log(`[vite] /media -> ${mediaTarget}`)

  return {
    base,
    plugins: [vue(), preloadTextFont(base)],
    //The server flag, given to the client in dev only: a build always gets false
    define: {
      "import.meta.env.DEV_AUTO_LOGIN": JSON.stringify(command === "serve" && env.DEV_AUTO_LOGIN === "true"),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        "/api":   { target: apiTarget,   changeOrigin: true, secure: false, xfwd: true },
        "/media": { target: mediaTarget, changeOrigin: true, secure: false },
      },
    },
  }
})
