import {expect,type Page} from '@playwright/test';

/** Modern's header carries Compare (GIT-8); the whole-session Changes view (failures, recorded checks, gaps, each file's edits) opens from the command palette's "Review changes and checks". Its listener is mounted with the header, so wait for that first. */
export async function openSessionReview(page:Page){
  await expect(page.locator('.modern-session-header').getByRole('button',{name:'Compare',exact:true})).toBeVisible();
  await page.evaluate(()=>window.dispatchEvent(new Event('drishya-session-review')));
}
