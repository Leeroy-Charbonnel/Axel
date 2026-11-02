//FIRST IMPORT ON PURPOSE: it refuses to start when a required variable is
//missing, before anything else opens a pool or builds an auth instance
import { ALLOWED_ORIGINS } from "./env"
import express from "express"
import cors from "cors"
import helmet from "helmet"
import compression from "compression"
import { toNodeHandler } from "better-auth/node"
import { auth, enforceSingleAccount } from "./auth"
import { HttpError, requireAdmin } from "./server/http"
import { STORAGE_DIR } from "./server/uploads"
import { imagesRouter } from "./server/images"
import { invalidateOnWrite, portfolioRouter } from "./server/portfolio"
import { filesRouter } from "./server/routes/files"
import { contentRouter } from "./server/routes/content"
import { modelsRouter, putViewerSettings } from "./server/routes/models"
import { settingsRouter } from "./server/routes/settings"
import { mountSite } from "./server/site"

const isProd = process.env.NODE_ENV === "production"
console.log(`[boot] Portfolio-Axel starting, NODE_ENV=${process.env.NODE_ENV}`)

const app = express()

//ONE PROXY IN FRONT: Traefik. Without this, req.ip is the proxy's address for
//every visitor, which is what a session row records as ipAddress.
app.set("trust proxy", 1)

//SECURITY HEADERS. The 3D viewer needs wasm (meshopt / Draco / KTX2
//decoders), blob workers, and blob: / data: fetches for textures embedded in
//a GLB. Inline styles stay allowed: Vue inserts large static template chunks
//as HTML, style attributes included. Every image is served from /media.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'", "'wasm-unsafe-eval'"],
      styleSrc:       ["'self'", "'unsafe-inline'"],
      imgSrc:         ["'self'", "data:", "blob:"],
      fontSrc:        ["'self'", "data:"],
      connectSrc:     ["'self'", "blob:", "data:"],
      mediaSrc:       ["'self'", "blob:"],
      workerSrc:      ["'self'", "blob:"],
      frameSrc:       ["https://www.youtube.com", "https://www.youtube-nocookie.com", "https://player.vimeo.com", "https://sketchfab.com"],
      objectSrc:      ["'none'"],
      baseUri:        ["'self'"],
      formAction:     ["'self'"],
      frameAncestors: ["'self'"],
      //on http://localhost it would upgrade every asset to an https that is not there
      upgradeInsecureRequests: isProd ? [] : null,
    },
  },
  strictTransportSecurity: isProd ? { maxAge: 31536000 } : false,
}))

//CORS - credentials required for better-auth cookies
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }))

//MEDIA - uploads under /media/{stored_filename}, public, and their resized
//copies under /media/{format}/{width}/{stored_filename}. Mounted before
//compression: models, videos and encoded images are served as they are.
app.use(imagesRouter)
app.use("/media", express.static(STORAGE_DIR, {
  immutable: true,
  maxAge:    "30d",
  //belt on top of the upload allow-list: the browser must not sniff a stored
  //file into active content on this origin
  setHeaders: (res) => {
    res.setHeader("X-Content-Type-Options", "nosniff")
  },
}))

app.use(compression())

//AUTH HANDLER - before any body parser, better-auth reads the body itself
app.all("/api/auth/{*path}", toNodeHandler(auth))

app.use("/api", invalidateOnWrite)

//the one route allowed a large body (an editor snapshot with dozens of
//materials and lights), parsed only once the admin is known
app.put("/api/models/:id/viewer-settings", requireAdmin, express.json({ limit: "10mb" }), putViewerSettings)
app.use(express.json({ limit: "1mb" }))

app.use(portfolioRouter, filesRouter, contentRouter, modelsRouter, settingsRouter)
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "not found" })
})

if (isProd) mountSite(app)

//GLOBAL ERROR HANDLER. An HttpError, or a body-parser error (400 bad JSON,
//413 too large), says why to the client. Anything else is ours: a 500 with
//no detail, the error in the log.
app.use((err: Error & { status?: number }, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (!(err instanceof HttpError) && !(err.status && err.status < 500)) {
    console.error(err)
    res.status(500).json({ error: "internal server error" })
    return
  }
  console.warn(`[http] ${err.status} ${req.method} ${req.path}: ${err.message}`)
  res.status(err.status!).json({ error: err.message })
})

const port = process.env.PORT ?? 3001

app.listen(port, async () => {
  console.log(`server running on http://localhost:${port}`)

  //ONE ACCOUNT ON THIS SITE. Promotion to admin is an UPDATE run in the
  //database, so this is the first moment the app can see it: once an admin
  //exists, every other account is deleted.
  try {
    const removed = await enforceSingleAccount()
    if (removed > 0) console.log(`[boot] removed ${removed} account(s) that were not the admin`)
  } catch (err) {
    //not fatal, and not silent: the next boot tries again
    console.error("[boot] could not enforce the single-account rule:", err)
  }
})
