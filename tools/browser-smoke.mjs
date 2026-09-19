// Optional browser QA. npm install --no-save --package-lock=false playwright
// All WebHID access is replaced before app code runs. No physical device opens.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve(process.env.PAGES_ROOT ?? '.');
const server = createServer(async (req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const path = resolve(root, `.${name === '/' ? '/index.html' : name}`);
  if (!path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    res.setHeader('Content-Type', { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css' }[extname(path)] ?? 'application/octet-stream');
    res.end(await readFile(path));
  } catch { res.writeHead(404).end(); }
});
let baseUrl = process.argv[2];
if (!baseUrl) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/`;
}
const browser = await chromium.launch(process.platform === 'win32' ? { channel: 'msedge', headless: true } : { headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const bytes = new Uint8Array(0x1b30);
    const pair = (addr, value) => { bytes[addr] = value; bytes[addr + 1] = (0x55 - value) & 255; };
    for (const addr of [0,2,4,6,8,10,0x4c,0x4e,0x50,0x52,0xa9,0xab,0xad,0xaf,0xb1,0xb3,0xb5,0xb7,0xb9]) pair(addr, 0);
    pair(0, 4); pair(2, 6); pair(4, 2); pair(10, 1);
    pair(6, 30); pair(8, 1); pair(0xbd, 0xe2); pair(0xbf, 1); pair(0xe1, 0);
    for (let slot = 0; slot < 8; slot++) {
      const dpi = [1200, 2400, 3800, 5600, 8000, 60000, 400, 800][slot] - 1;
      const addr = 0x1b00 + slot * 6;
      bytes.set([dpi & 255, dpi >> 8, dpi & 255, dpi >> 8, 0], addr);
      bytes[addr + 5] = (0x55 - bytes.slice(addr, addr + 5).reduce((a,b) => a+b, 0)) & 255;
    }
    for (const [slot, value] of [1,2,4,8,16].entries()) bytes.set([1, value, 0, (0x54-value)&255], 0x60 + slot * 4);
    bytes.set([2,1,0,0x52], 0x74);
    const device = new EventTarget();
    Object.assign(device, {
      vendorId: 0x3554, productId: 0xf517, productName: 'ATTACK SHARK Mouse', opened: false,
      async open() { this.opened = true; }, async close() { this.opened = false; },
      async sendReport(reportId, request) {
        window.__fakeMouse.opcodes.push(request[0]);
        if (request[0] === 2) return;
        const response = new Uint8Array(16); response[0] = request[0];
        switch (request[0]) {
          case 1: response.set([124,20,5],9); break;
          case 3: response[5]=1; break;
          case 4: response.set([55,0,0x0f,0x32],5); break;
          case 0x0e: response[5]=window.__fakeMouse.profile; break;
          case 8: {
            const addr=(request[2]<<8)|request[3], length=request[4];
            response.set(request.slice(2,5),2); response.set(bytes.slice(addr,addr+length),5); break;
          }
          case 0x12: case 0x1d: case 0xb3: response.set([5,2],5); break;
          case 0x2d: response.set([0xfe, 2, 1], 5); break;
          case 0x17: case 0x2b: case 0x19: break;
          default: throw new Error(`Unexpected write opcode ${request[0]}`);
        }
        response[15]=(0x4d-response.slice(0,15).reduce((a,b)=>a+b,0))&255;
        setTimeout(() => {
          const event=new Event('inputreport'); Object.assign(event,{reportId,data:new DataView(response.buffer)}); device.dispatchEvent(event);
        }, 1);
      },
    });
    window.__fakeMouse = { bytes, profile: 0, opcodes: [] };
    const hid = new EventTarget();
    hid.getDevices = async () => [];
    hid.requestDevice = async () => [device];
    Object.defineProperty(navigator, 'hid', { value: hid, configurable: true });
  });
  await page.goto(baseUrl);
  await page.locator('#connect-btn').click();
  await page.getByText('51', { exact: false }).first().waitFor();
  await page.waitForFunction(() => document.querySelector('#connect-btn').textContent === 'Disconnect' && !document.querySelector('#connect-btn').disabled);
  await page.locator('[data-tab="buttons"]').click();
  assert.equal(await page.locator('[data-button-row]').count(), 5);
  await page.locator('[data-tab="sensor"]').click();
  assert.equal(await page.locator('#lod-raw option').count(), 5);
  assert.equal(await page.locator('#lod-raw').inputValue(), '1');
  assert.equal(await page.locator('.dpi-stage').count(), 6);
  assert.equal(await page.locator('#sensor-rotation').inputValue(), '-30');
  assert.equal(await page.locator('#scan-20k').isChecked(), false);
  await page.locator('label.switch').filter({ has: page.locator('#scan-20k') }).click();
  await page.getByText('Candidate or unknown scalar writes require Expert writes.', { exact: true }).waitFor();
  await page.locator('[data-tab="lighting"]').click();
  assert.equal(await page.locator('[data-save-receiver-led]').count(), 3);
  assert.equal(await page.locator('[data-save-receiver-led="0"]').isDisabled(), true);
  await page.locator('#read-receiver-led').click();
  await page.waitForFunction(() => !document.querySelector('[data-save-receiver-led="0"]').disabled);
  assert.equal(await page.locator('#receiver-led-0').inputValue(), '254');
  assert.match(await page.locator('#receiver-led-0 option:checked').textContent(), /Keep unknown/);
  assert.equal(await page.locator('#receiver-led-1').inputValue(), '2');
  assert.equal(await page.locator('#receiver-led-2').inputValue(), '1');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'receiver controls fit a narrow viewport');
  await page.setViewportSize({ width: 1440, height: 1100 });
  await mkdir('captures', { recursive: true });
  await page.screenshot({ path: 'captures/receiver-browser-smoke.png', fullPage: true });
  await page.locator('[data-tab="diagnostics"]').click();
  await page.locator('#probe-versions').click();
  await page.waitForFunction(() => !document.querySelector('#export-endpoints').disabled);
  assert.match(await page.locator('#content pre').textContent(), /Wireless slave-version endpoint/);
  await page.locator('#probe-receiver').click();
  await page.waitForFunction(() => !document.querySelector('#probe-receiver').disabled);
  assert.match(await page.locator('#content pre').textContent(), /Receiver RGB raw state/);
  await page.locator('#capture-preset').selectOption('sensor');
  await page.locator('#capture-notes').fill('Synthetic QA only: candidate + unknown bytes');
  await page.locator('#capture-before').click();
  await page.waitForFunction(() => !document.querySelector('#capture-after').disabled);
  await page.evaluate(() => { window.__fakeMouse.bytes[0xbd] = 1; window.__fakeMouse.bytes[0xbb] = 2; });
  await page.locator('#capture-after').click();
  await page.waitForFunction(() => !document.querySelector('#capture-compare').disabled);
  await page.locator('#capture-compare').click();
  assert.match(await page.locator('#capture-summary').textContent(), /2 changed bytes/);
  assert.match(await page.locator('#capture-lab tbody').textContent(), /candidate/);
  assert.match(await page.locator('#capture-lab tbody').textContent(), /unknown/);
  const downloading = page.waitForEvent('download');
  await page.locator('#capture-export').click();
  const download = await downloading;
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(exported.before.activeProfile, 0);
  assert.deepEqual(exported.diff.map((row) => row.address), [0xbb, 0xbd]);
  await page.locator('#connect-btn').click();
  await page.waitForFunction(() => document.querySelector('#connect-btn').textContent === 'Connect mouse' && !document.querySelector('#connect-btn').disabled);
  assert.match(await page.locator('#capture-summary').textContent(), /2 changed bytes/);
  assert.equal(await page.locator('#capture-before').isDisabled(), true);
  assert.equal(await page.locator('#capture-export').isDisabled(), false);
  const opcodes = await page.evaluate(() => window.__fakeMouse.opcodes);
  assert.equal(opcodes.some((opcode) => [5,7,9,0x0f,0x16,0x18,0x2c].includes(opcode)), false);
  await page.reload();
  await page.locator('[data-tab="diagnostics"]').click();
  await page.locator('#capture-file').setInputFiles({ name: 'synthetic.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await page.waitForFunction(() => document.querySelector('#capture-summary').textContent.includes('2 changed bytes'));
  await mkdir('captures', { recursive: true });
  await page.screenshot({ path: 'captures/diagnostics-browser-smoke.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  console.log('Browser QA passed: five buttons, six enabled stages, LOD responsiveness, candidate write gate, capture/diff/export/import/disconnect, mobile layout. All HID traffic was simulated.');
} finally {
  await browser.close();
  server.close();
}
