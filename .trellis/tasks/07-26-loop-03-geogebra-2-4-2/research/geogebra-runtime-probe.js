'use strict';

const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const PORT = 9147;
const EVIDENCE_DIR = path.resolve(__dirname, '..', 'evidence');

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    html, body { margin: 0; background: #f7f8fa; }
    #ggb { width: 1000px; height: 680px; margin: 24px auto; background: white; }
  </style>
</head>
<body>
  <div id="ggb"></div>
  <script src="https://www.geogebra.org/apps/deployggb.js"></script>
</body>
</html>`;

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, '127.0.0.1', resolve);
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

async function main() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  let browser;
  await listen(server);
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
    const errors = [];
    const failedRequests = [];
    page.on('pageerror', (err) => errors.push(`pageerror:${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console:${msg.text()}`);
    });
    page.on('requestfailed', (req) => {
      if (/geogebra/i.test(req.url())) {
        failedRequests.push(`${req.failure()?.errorText || 'failed'} ${req.url()}`);
      }
    });

    await page.goto(`http://127.0.0.1:${PORT}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.GGBApplet === 'function', null, { timeout: 30000 });
    await page.evaluate(() => new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('appletOnLoad timeout')), 75000);
      const params = {
        id: 'ggbProbe',
        appName: 'classic',
        width: 1000,
        height: 680,
        perspective: 'G/D',
        showToolBar: false,
        showMenuBar: false,
        showAlgebraInput: false,
        showResetIcon: false,
        enableRightClick: false,
        enableShiftDragZoom: false,
        appletOnLoad(api) {
          window.clearTimeout(timer);
          window.__probeApi = api;
          api.setErrorDialogsActive(false);
          api.evalCommand('SetActiveView(1)');
          api.evalCommand('xSignal(x)=If(x>=-1,1,0)');
          api.setColor('xSignal', 37, 99, 235);
          api.evalCommand('SetActiveView(2)');
          api.evalCommand('output(x)=If(x<-3,0,1-exp(-(x+3)))');
          api.evalCommand('sample=output(-2)');
          api.setColor('output', 180, 83, 9);
          api.evalCommand('SetActiveView(1)');
          resolve();
        },
      };
      const applet = new window.GGBApplet(params, true);
      applet.setHTML5Codebase('https://www.geogebra.org/apps/5.4.920.0/web3d');
      window.__probeApplet = applet;
      applet.inject('ggb');
    }));
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      window.__probeApi.setGraphicsOptions(1, { xmin: -4.5, xmax: 5.5, ymin: -0.35, ymax: 2.35, grid: false });
      window.__probeApi.setGraphicsOptions(2, { xmin: -4.5, xmax: 3.5, ymin: -0.2, ymax: 1.2, grid: false });
      window.__probeApi.evalCommand('SetActiveView(1)');
      window.__probeApi.evalCommand('ZoomIn(-4.5,-0.35,5.5,2.35)');
      window.__probeApi.evalCommand('SetActiveView(2)');
      window.__probeApi.evalCommand('ZoomIn(-4.5,-0.2,3.5,1.2)');
    });
    await page.waitForTimeout(300);

    const result = await page.evaluate(() => ({
      sample: window.__probeApi.getValue('sample'),
      viewMethods: Object.keys(window.__probeApi).filter((key) => /coord|view|graphic/i.test(key)).sort(),
      setGraphicsOptionsSource: String(window.__probeApi.setGraphicsOptions),
      view1Properties: window.__probeApi.getViewProperties(1),
      view2Properties: window.__probeApi.getViewProperties(2),
      objectNames: String(window.__probeApi.getAllObjectNames()).split(','),
      xXml: window.__probeApi.getXML('xSignal'),
      outputXml: window.__probeApi.getXML('output'),
      graphics1: window.__probeApi.getGraphicsOptions(1),
      graphics2: window.__probeApi.getGraphicsOptions(2),
      canvasCount: [...document.querySelectorAll('#ggb canvas')]
        .filter((canvas) => canvas.width > 0 && canvas.height > 0).length,
      appletRect: document.querySelector('#ggb').getBoundingClientRect().toJSON(),
    }));

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'geogebra-technical-probe.png'), fullPage: true });
    await page.evaluate(() => window.__probeApi.remove());
    result.canvasCountAfterRemove = await page.locator('#ggb canvas').count();
    result.errors = errors;
    result.failedRequests = failedRequests;
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (browser) await browser.close();
    await close(server);
  }
}

main().catch((err) => {
  console.error(err && err.stack || err);
  process.exitCode = 1;
});
