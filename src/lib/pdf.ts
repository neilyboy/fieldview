import puppeteer from "puppeteer-core";
import { printKey } from "./auth";

const BASE = () => process.env.INTERNAL_BASE_URL ?? `http://127.0.0.1:3000`;

export async function sitePdf(siteId: string, query: string, base?: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1240, height: 1754 });
    const url = `${base ?? BASE()}/print/sites/${siteId}${query}`;
    await page.goto(url, { waitUntil: "networkidle0", timeout: 90000 });
    await page.waitForFunction("window.__printReady === true", { timeout: 60000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "14mm" },
      displayHeaderFooter: true,
      headerTemplate: `<div style="width:100%;font-size:8px;font-family:monospace;color:#94a3b8;padding:0 14mm;text-align:right">FieldView</div>`,
      footerTemplate: `<div style="width:100%;font-size:8px;font-family:monospace;color:#94a3b8;padding:0 14mm;display:flex;justify-content:space-between"><span></span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export function printQuery(siteId: string): string {
  return `?key=${printKey(siteId)}`;
}
