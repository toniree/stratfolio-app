import { chromium } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const installUrl = process.argv[2]
if (!installUrl || !installUrl.startsWith('https://')) {
  throw new Error('Usage: node scripts/generate-install-qr.mjs https://your-deployed-app.example/')
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const qrUrl = `https://quickchart.io/qr?size=800&text=${encodeURIComponent(installUrl)}`
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 800, height: 800 } })
await page.goto(qrUrl, { waitUntil: 'networkidle' })
await page.locator('img').screenshot({ path: path.join(root, 'StratFolioUI-install-qr.png') })
await browser.close()
