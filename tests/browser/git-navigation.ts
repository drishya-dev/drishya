import type { Page } from '@playwright/test';

/** Modern has one entry; developer-only older presentations retain their direct reader button. */
export function gitEntry(page: Page, destination: 'Git review' | 'Git graph') {
  return page.getByRole('button', { name: 'Git', exact: true }).or(page.getByRole('button', { name: destination, exact: true }));
}
export async function openGitDestination(page: Page, destination: 'Git review' | 'Git graph') {
  await gitEntry(page, destination).waitFor({ state: 'visible' });
  const entry = page.getByRole('button', { name: 'Git', exact: true });
  if (await entry.isVisible()) await entry.click();
  await page.getByRole('button', { name: destination, exact: true }).click();
}
