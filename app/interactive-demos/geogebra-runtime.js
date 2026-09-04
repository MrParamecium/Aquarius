// GeoGebra runtime adapter. Keeps CDN loading, trusted scene registration,
// applet construction, and teardown outside individual lesson renderers.

const GEOGEBRA_LOADER_URL = 'https://www.geogebra.org/apps/deployggb.js';
const GEOGEBRA_CODEBASE_URL = 'https://www.geogebra.org/apps/5.4.920.0/web3d';
const GEOGEBRA_LOADER_ID = 'ftutor-geogebra-loader';
const GEOGEBRA_LOAD_TIMEOUT_MS = 15000;
const GEOGEBRA_APPLET_TIMEOUT_MS = 20000;

const geoGebraSceneRegistry = new Map();
let geoGebraLoaderPromise = null;
let geoGebraAppletSequence = 0;

function registerGeoGebraScene(sceneId, factory) {
  const normalizedId = String(sceneId || '').trim();
  if (!/^[a-z][a-z0-9_]*$/.test(normalizedId)) {
    throw new Error(`Invalid GeoGebra scene id: ${normalizedId || '(empty)'}`);
  }
  if (typeof factory !== 'function') {
    throw new TypeError(`GeoGebra scene ${normalizedId} must register a factory function`);
  }
  if (geoGebraSceneRegistry.has(normalizedId)) {
    throw new Error(`GeoGebra scene already registered: ${normalizedId}`);
  }
  geoGebraSceneRegistry.set(normalizedId, factory);
}

function getGeoGebraSceneFactory(sceneId) {
  return geoGebraSceneRegistry.get(String(sceneId || '').trim()) || null;
}

function removeFailedGeoGebraLoader() {
  const script = document.getElementById(GEOGEBRA_LOADER_ID);
  if (script && script.dataset.geogebraReady !== '1') script.remove();
}

function loadGeoGebraRuntime(options = {}) {
  if (typeof window.GGBApplet === 'function') return Promise.resolve(window.GGBApplet);
  if (options.retry) {
    geoGebraLoaderPromise = null;
    removeFailedGeoGebraLoader();
  }
  if (geoGebraLoaderPromise) return geoGebraLoaderPromise;

  geoGebraLoaderPromise = new Promise((resolve, reject) => {
    let settled = false;
    let script = document.getElementById(GEOGEBRA_LOADER_ID);
    let appendScript = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (error) {
        geoGebraLoaderPromise = null;
        removeFailedGeoGebraLoader();
        reject(error);
        return;
      }
      script.dataset.geogebraReady = '1';
      resolve(window.GGBApplet);
    };
    const onLoad = () => {
      if (typeof window.GGBApplet !== 'function') {
        finish(new Error('GeoGebra loader finished without exposing GGBApplet'));
        return;
      }
      finish();
    };
    const onError = () => finish(new Error('GeoGebra loader could not be downloaded'));
    const timer = window.setTimeout(() => {
      finish(new Error('GeoGebra loader timed out'));
    }, GEOGEBRA_LOAD_TIMEOUT_MS);

    if (!script) {
      script = document.createElement('script');
      script.id = GEOGEBRA_LOADER_ID;
      script.src = GEOGEBRA_LOADER_URL;
      script.async = true;
      script.dataset.geogebraLoader = '1';
      appendScript = true;
    }
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    if (appendScript) document.head.appendChild(script);
    if (typeof window.GGBApplet === 'function') onLoad();
  });

  return geoGebraLoaderPromise;
}

async function createGeoGebraApplet(container, options = {}) {
  if (!container || typeof container.appendChild !== 'function') {
    throw new TypeError('A valid GeoGebra mount container is required');
  }
  const signal = options.signal;
  if (signal?.aborted) throw new DOMException('GeoGebra mount was cancelled', 'AbortError');
  const GGBAppletConstructor = await loadGeoGebraRuntime({ retry: options.retry });
  if (signal?.aborted) throw new DOMException('GeoGebra mount was cancelled', 'AbortError');

  geoGebraAppletSequence += 1;
  const appletId = `ftutorGeoGebraApplet${geoGebraAppletSequence}`;
  if (!container.id) container.id = `ftutor-geogebra-mount-${geoGebraAppletSequence}`;
  const mountId = container.id;
  let api = null;
  let removed = false;
  let settled = false;
  let applet = null;

  const ready = new Promise((resolve, reject) => {
    const finish = (error, loadedApi) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (error) reject(error); else resolve(loadedApi);
    };
    const onAbort = () => {
      removed = true;
      try { api?.remove?.(); } catch (_) {}
      container.replaceChildren();
      finish(new DOMException('GeoGebra mount was cancelled', 'AbortError'));
    };
    const timer = window.setTimeout(() => {
      finish(new Error('GeoGebra applet initialization timed out'));
    }, Number(options.timeoutMs) || GEOGEBRA_APPLET_TIMEOUT_MS);

    signal?.addEventListener('abort', onAbort, { once: true });
    const params = {
      id: appletId,
      appName: 'classic',
      width: Math.max(320, Math.round(Number(options.width) || 760)),
      height: Math.max(200, Math.round(Number(options.height) || 620)),
      perspective: 'G',
      showToolBar: false,
      showMenuBar: false,
      showAlgebraInput: false,
      showResetIcon: false,
      showZoomButtons: false,
      enableRightClick: false,
      enableShiftDragZoom: false,
      enableLabelDrags: false,
      errorDialogsActive: false,
      useBrowserForJS: true,
      appletOnLoad(loadedApi) {
        api = loadedApi;
        if (removed || signal?.aborted) {
          try { loadedApi?.remove?.(); } catch (_) {}
          container.replaceChildren();
          finish(new DOMException('GeoGebra mount was cancelled', 'AbortError'));
          return;
        }
        if (!loadedApi || typeof loadedApi.evalCommand !== 'function') {
          finish(new Error('GeoGebra applet did not provide a usable JavaScript API'));
          return;
        }
        try { loadedApi.setErrorDialogsActive?.(false); } catch (_) {}
        finish(null, loadedApi);
      },
    };

    try {
      applet = new GGBAppletConstructor(params, true);
      applet.setHTML5Codebase(GEOGEBRA_CODEBASE_URL);
      applet.inject(mountId);
    } catch (error) {
      finish(error);
    }
  });

  api = await ready;
  const handle = {
    id: appletId,
    api,
    setSize(width, height) {
      if (removed) return;
      const nextWidth = Math.max(320, Math.round(Number(width) || 0));
      const nextHeight = Math.max(200, Math.round(Number(height) || 0));
      try { api.setSize(nextWidth, nextHeight); } catch (_) {}
    },
    remove() {
      if (removed) return;
      removed = true;
      try { api.remove?.(); } catch (_) {}
      container.replaceChildren();
    },
  };
  return handle;
}

window.__ftutorGeoGebraRuntime = {
  codebaseUrl: GEOGEBRA_CODEBASE_URL,
  loaderUrl: GEOGEBRA_LOADER_URL,
  load: loadGeoGebraRuntime,
  createApplet: createGeoGebraApplet,
  registerScene: registerGeoGebraScene,
  getSceneFactory: getGeoGebraSceneFactory,
};
