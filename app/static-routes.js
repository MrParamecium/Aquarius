/*
 * Static-file routing (extracted from ws-bridge.js in Phase 1 #8).
 *
 * Owns:
 *   - serveStaticFile / serveStaticFromDir helpers (path-traversal guarded,
 *     no-cache headers on JS/HTML/CSS so the owner doesn't get stale code
 *     after a release)
 *   - handleStaticRoute(req, res, pathname) — the consolidated static-route
 *     dispatcher. Handles /generated/, /new-pages/, /pages/, /figures/,
 *     /lesson-illustrations/, /api/crop (pre-cropped figure PNG with fuzzy
 *     fallback), and the catch-all `app/`-relative file lookup that ends the
 *     request handler.
 *
 * Returns true when the route was handled, false to let the API handler
 * keep going. The bridge's request handler used to inline all of this; now
 * it calls handleStaticRoute once near the end of its chain.
 *
 * Factory pattern follows Phase 1 #4-#7. Bridge injects MIME map and the
 * resource directory constants.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const url = require('url');

// Anchored startsWith for path-traversal guards. The naive `filePath.startsWith(baseDir)`
// admits sibling-directory escape: '/parent/app2/x'.startsWith('/parent/app') === true.
// Anchoring on path.sep (or exact match) closes that gap.
function isUnder(filePath, baseDir) {
    return filePath === baseDir || filePath.startsWith(baseDir + path.sep);
}

/**
 * @param {{
 *   mimeTypes: Record<string, string>,
 *   generatedDir: string,
 *   pageImageDirNew: string,
 *   tutorMaterialsDir: string,
 *   appDir: string,
 * }} deps
 */
module.exports = function createStaticRoutes(deps) {
    const MIME_TYPES = deps && deps.mimeTypes;
    const GENERATED_DIR = deps && deps.generatedDir;
    const PAGE_IMAGE_DIR_NEW = deps && deps.pageImageDirNew;
    const TUTOR_MATERIALS_DIR = deps && deps.tutorMaterialsDir;
    const APP_DIR = deps && deps.appDir;
    if (!MIME_TYPES || typeof MIME_TYPES !== 'object'
        || typeof GENERATED_DIR !== 'string' || !GENERATED_DIR
        || typeof PAGE_IMAGE_DIR_NEW !== 'string' || !PAGE_IMAGE_DIR_NEW
        || typeof TUTOR_MATERIALS_DIR !== 'string' || !TUTOR_MATERIALS_DIR
        || typeof APP_DIR !== 'string' || !APP_DIR) {
        throw new Error('static-routes: missing required deps {mimeTypes, generatedDir, pageImageDirNew, tutorMaterialsDir, appDir}');
    }

    function serveStaticFile(res, filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        // No-cache for JS/HTML/CSS to ensure fresh code always loads
        const noCache = ['.js', '.html', '.css'].includes(ext);

        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Not found');
                return;
            }

            const headers = { 'Content-Type': contentType };
            if (noCache) {
                headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
                headers['Pragma'] = 'no-cache';
            }
            res.writeHead(200, headers);
            res.end(data);
        });
    }

    function serveStaticFromDir(res, baseDir, requestedName) {
        const safeName = path.basename(requestedName || '');
        const filePath = path.join(baseDir, safeName);

        if (!isUnder(filePath, baseDir)) {
            res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Forbidden');
            return;
        }

        serveStaticFile(res, filePath);
    }

    /**
     * Dispatch a static-file route. Returns true if handled, false otherwise.
     * Call near the end of the bridge's request handler — any API route that
     * should override a static path must run first.
     */
    function handleStaticRoute(req, res, pathname) {
        if (pathname.startsWith('/generated/')) {
            const filename = pathname.replace(/^\/generated\//, '');
            serveStaticFile(res, path.join(GENERATED_DIR, filename));
            return true;
        }

        // /new-pages/* serves the active (3rd Ed) book pages.
        // /pages/* is kept as a back-compat alias for cached lesson markdown that
        // still references the old root; both now serve from PAGE_IMAGE_DIR_NEW.
        if (pathname.startsWith('/new-pages/') || pathname.startsWith('/pages/')) {
            const filename = pathname.replace(/^\/(?:new-pages|pages)\//, '');
            serveStaticFromDir(res, PAGE_IMAGE_DIR_NEW, filename);
            return true;
        }

        if (pathname.startsWith('/figures/')) {
            const filename = pathname.replace(/^\/figures\//, '');
            const figurePath = path.join(TUTOR_MATERIALS_DIR, 'new-book-figures', filename);
            serveStaticFile(res, figurePath);
            return true;
        }

        if (pathname.startsWith('/lesson-illustrations/')) {
            const illustrationDir = path.join(TUTOR_MATERIALS_DIR, 'lesson-illustrations');
            let requestedPath;
            try {
                requestedPath = decodeURIComponent(pathname.replace(/^\/lesson-illustrations\//, ''));
            } catch (_) {
                res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Bad request');
                return true;
            }
            const illustrationPath = path.resolve(illustrationDir, requestedPath);
            if (!isUnder(illustrationPath, illustrationDir)) {
                res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Forbidden');
                return true;
            }
            serveStaticFile(res, illustrationPath);
            return true;
        }

        // /api/crop?page=book-016&fig=Fig.+B.6  — serves pre-cropped figure PNG
        if (pathname === '/api/crop') {
            const query = url.parse(req.url, true).query;
            const pageId = (query.page || '').replace(/[^a-zA-Z0-9-_]/g, '');
            const figId = query.fig || '';
            if (!pageId) { res.writeHead(400); res.end('missing page'); return true; }

            const CROPS_DIR = path.join(GENERATED_DIR, 'crops');

            // Build expected pre-cropped filename: book-016--Fig--B-6.png
            const safeFigId = figId.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
            const cropFile = `${pageId}--${safeFigId}.png`;
            const cropPath = path.join(CROPS_DIR, cropFile);

            if (fs.existsSync(cropPath)) {
                serveStaticFromDir(res, CROPS_DIR, cropFile);
                return true;
            }

            // Fuzzy fallback: find any crop for this page
            if (fs.existsSync(CROPS_DIR)) {
                const all = fs.readdirSync(CROPS_DIR);
                const match = all.find(f => f.startsWith(pageId + '--'));
                if (match) { serveStaticFromDir(res, CROPS_DIR, match); return true; }
            }

            // Last resort: full page
            serveStaticFromDir(res, PAGE_IMAGE_DIR_NEW, `${pageId}.png`);
            return true;
        }

        // Catch-all: serve any file under APP_DIR (path-traversal guarded).
        const requestedFile = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
        const filePath = path.join(APP_DIR, requestedFile);

        if (!isUnder(filePath, APP_DIR)) {
            res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Forbidden');
            return true;
        }

        serveStaticFile(res, filePath);
        return true;
    }

    return {
        handleStaticRoute,
    };
};
