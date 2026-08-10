import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = `file://${path.join(root, 'public/app-icon.svg')}`
const outputs = [
  [192, 'icon-192.png'],
  [512, 'icon-512.png'],
  [180, 'apple-touch-icon.png'],
]

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

for (const [size, filename] of outputs) {
  await page.setViewportSize({ width: size, height: size })
  await page.goto(source)
  await page.screenshot({ path: path.join(root, 'public/icons', filename), omitBackground: false })
}

await browser.close()
