import puppeteer from 'puppeteer'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { sleep } from '@polioan/common'
import { urls } from './constants/urls.js'
import { adCssSelectors, excessLayoutCssSelectors } from './constants/css.js'
import { PDFDocument } from 'pdf-lib'

async function downloadPage(i: number, url: string, page: puppeteer.Page) {
  await page.goto(url, { waitUntil: 'load' })

  await page.evaluate(
    ({ adCssSelectors, excessLayoutCssSelectors }) => {
      for (const selector of [...adCssSelectors, ...excessLayoutCssSelectors]) {
        try {
          Array.from(document.querySelectorAll(selector)).forEach(el => {
            el.remove()
          })
        } catch {}
      }
    },
    { adCssSelectors, excessLayoutCssSelectors }
  )

  await page.pdf({
    format: 'A4',
    displayHeaderFooter: true,
    path: path.join(dataFolderFromDirname, `${i}.pdf`),
  })
}

async function downloadPages(page: puppeteer.Page) {
  for (const [i, url] of urls.entries()) {
    console.log({ url })
    await downloadPage(i, url, page)
    await sleep(30)
  }
}

async function buildPdf() {
  const pdfDoc = await PDFDocument.create()
  const inputs = await fsp.readdir(dataFolderFromDirname)
  for (const [i, inputPDF] of inputs.entries()) {
    console.log(`${i + 1} / ${inputs.length} pdf`)
    const pdfBytes = await fsp.readFile(
      path.join(dataFolderFromDirname, inputPDF)
    )
    const inputDoc = await PDFDocument.load(pdfBytes)
    const copiedPages = await pdfDoc.copyPages(
      inputDoc,
      inputDoc.getPageIndices()
    )
    copiedPages.forEach(page => pdfDoc.addPage(page))
  }
  const pdfBytes = await pdfDoc.save()
  await fsp.writeFile(path.join(dataFolderFromDirname, 'docs.pdf'), pdfBytes)
}

const dataFolderFromDirname = path.join(process.cwd(), 'dist', 'data')

async function createDataFolder() {
  await fsp.rm(dataFolderFromDirname, { recursive: true, force: true })
  await fsp.mkdir(dataFolderFromDirname, { recursive: false })
}

async function run() {
  console.log('Start build')

  if (process.env.SKIP_BROWSER === undefined) {
    await createDataFolder()

    const browser = await puppeteer.launch({ headless: 'new' })
    const page = await browser.newPage()
    await page.setViewport({ width: 822, height: 1131 })

    console.log('Browser started')

    await downloadPages(page)

    await browser.close()
  }

  console.log('Browser closed, creating pdf')

  await buildPdf()
}

run()
  .then(() => {
    console.log('Build successful')
  })
  .catch(e => {
    console.error('Build failed with - ')
    console.error(e)
    process.exit(1)
  })
