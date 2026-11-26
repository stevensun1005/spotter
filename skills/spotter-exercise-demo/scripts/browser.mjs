import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

export function launchRenderer(executablePath) {
  const useSystemGPU = process.env.SPOTTER_DEMO_SYSTEM_GPU === '1';
  return chromium.launch({
    executablePath: resolve(executablePath),
    headless: true,
    args: useSystemGPU ? [] : ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  });
}

export async function openRenderer(browser, renderer) {
  const page = await browser.newPage();
  try {
    await page.route(/^https?:/, (route) => route.abort());
    await page.goto(String(renderer));
    await page.waitForFunction(() => Boolean(window.spotterDemoRenderer));
    return page;
  } catch (error) {
    await page.close();
    throw error;
  }
}
