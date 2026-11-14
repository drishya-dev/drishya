import { expect, type Page } from '@playwright/test';

/** GIT-9: the header's Git icon opens Git graph in one click; developer-only older presentations kept a direct "Git graph" button. */
export function gitEntry(page: Page, destination: 'Git graph' = 'Git graph') {
  return page.getByRole('button', { name: 'Git', exact: true }).or(page.getByRole('button', { name: destination, exact: true }));
}
export async function openGitDestination(page: Page, destination: 'Git graph' = 'Git graph') {
  const entry = gitEntry(page, destination).first();
  await entry.waitFor({ state: 'visible' });
  await entry.click();
}

/** The Changes window (GIT-8, named by GIT-9) on one of its views; Uncommitted shows what Git review used to show. */
export async function openChanges(page: Page, view: 'Uncommitted' | 'This session' | 'Branch' | 'Pull request' = 'Uncommitted') {
  const header = page.locator('.modern-session-header').getByRole('button', { name: 'Changes', exact: true });
  await header.waitFor({ state: 'visible' });
  const changes = page.getByRole('region', { name: 'Changes', exact: true });
  if (!(await changes.isVisible())) await header.click();
  await expect(changes).toBeVisible();
  await changes.getByRole('button', { name: view, exact: true }).click();
  return changes;
}

/** Approves read-only Git when Changes asks, then waits for its working-tree list. */
export async function readUncommitted(page: Page) {
  const changes = await openChanges(page, 'Uncommitted');
  const approve = changes.getByRole('button', { name: 'Approve read-only Git' });
  await expect(approve.or(changes.locator('.compare-body'))).toBeVisible();
  if (await approve.isVisible()) await approve.click();
  await expect(changes.locator('.compare-body')).toBeVisible();
  return changes;
}
