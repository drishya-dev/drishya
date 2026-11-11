import {test,expect} from '@playwright/test';
import {spawnSync} from 'node:child_process';
import {serveLanding} from '../../scripts/build-landing.ts';

let site:Awaited<ReturnType<typeof serveLanding>>;
test.beforeAll(async()=>{
  const built=spawnSync(process.execPath,['scripts/build-landing.ts'],{encoding:'utf8'});
  if(built.status!==0)throw Error(built.stderr);
  site=await serveLanding();
});
test.afterAll(async()=>{await site?.close();});

test('1. /#how-it-works resolves to a unique native anchor clear of the header with complete copy',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto(site.url+'/#how-it-works');
  await page.evaluate(()=>document.fonts.ready);

  const section=page.locator('#how-it-works');
  await expect(section).toHaveCount(1);
  const headingId=await section.getAttribute('aria-labelledby');
  expect(headingId).toBeTruthy();

  const heading=page.locator(`#${headingId}`);
  await expect(heading).toBeVisible();
  await expect(heading).toContainText('Your agent writes code.');
  await expect(heading).toContainText('Drishya shows the work.');

  const support=section.locator('.explainer-support');
  await expect(support).toHaveText('Watch the files it reads, commands it runs, and changes it makes.');

  const paragraph=section.locator('.explainer-body');
  await expect(paragraph).toHaveText('Keep your agent’s work in view as it happens. Open the source it read, inspect the output it received, and review the edit it recorded. Return to any captured moment without losing the context of your repository.');

  const headingBox=await heading.boundingBox();
  expect(headingBox).not.toBeNull();
  expect(headingBox!.y).toBeGreaterThanOrEqual(64);
});

test('2. explainer is immediately before #session in normal flow without sticky or viewport spacers',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto(site.url+'/#how-it-works');

  const section=page.locator('#how-it-works');
  const session=page.locator('#session');
  await expect(section).toBeVisible();
  await expect(session).toBeVisible();

  const isImmediatelyBefore=await page.evaluate(()=>{
    const explainer=document.getElementById('how-it-works');
    return explainer?.nextElementSibling?.id==='session';
  });
  expect(isImmediatelyBefore).toBe(true);

  const styles=await section.evaluate(el=>{
    const cs=getComputedStyle(el);
    return {
      position:cs.position,
      height:el.getBoundingClientRect().height,
      viewportHeight:innerHeight,
    };
  });
  expect(styles.position).not.toBe('fixed');
  expect(styles.position).not.toBe('sticky');
  expect(styles.height).toBeLessThan(styles.viewportHeight*1.5);
});

test('3. direct visit with JavaScript disabled shows complete copy, artwork, and working links',async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:1440,height:900}});
  const page=await context.newPage();
  await page.goto(site.url+'/#how-it-works');

  const section=page.locator('#how-it-works');
  await expect(section.locator('h2')).toContainText('Your agent writes code.');
  await expect(section.locator('h2')).toContainText('Drishya shows the work.');
  await expect(section.locator('.explainer-support')).toBeVisible();
  await expect(section.locator('.explainer-body')).toBeVisible();
  await expect(section.locator('.explainer-art')).toBeVisible();
  await expect(section.locator('[data-emblem]')).toHaveCount(3);

  const productLink=page.locator('.desktop-nav a[href="/#workspace"]');
  await expect(productLink).toBeVisible();
  await context.close();
});

test('4. reduced motion and ?motion=0 render artwork immediately with no running timed animation',async({browser})=>{
  const context1=await browser.newContext({viewport:{width:1440,height:900}});
  const page1=await context1.newPage();
  await page1.emulateMedia({reducedMotion:'reduce'});
  await page1.goto(site.url+'/#how-it-works');

  const section1=page1.locator('#how-it-works');
  await expect(section1.locator('.explainer-art')).toBeVisible();
  const animCount1=await section1.evaluate(el=>{
    return el.querySelectorAll('[data-emblem-inner]').length>0
      ? Array.from(el.querySelectorAll('[data-emblem-inner]')).flatMap(e=>e.getAnimations()).length
      : 0;
  });
  expect(animCount1).toBe(0);
  await context1.close();

  const context2=await browser.newContext({viewport:{width:1440,height:900}});
  const page2=await context2.newPage();
  await page2.goto(site.url+'/?motion=0#how-it-works');
  const section2=page2.locator('#how-it-works');
  await expect(section2.locator('.explainer-art')).toBeVisible();
  const animCount2=await section2.evaluate(el=>{
    return Array.from(el.querySelectorAll('[data-emblem-inner]')).flatMap(e=>e.getAnimations()).length;
  });
  expect(animCount2).toBe(0);
  await context2.close();
});

test('5. first eligible visibility animates only inner graphics and does not replay on scroll out and back',async({browser})=>{
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();
  await page.goto(site.url);
  await page.keyboard.press('Escape');

  const slots=page.locator('#how-it-works .explainer-slot');
  await expect(slots).toHaveCount(3);
  const initialSlotWidths=await slots.evaluateAll(els=>els.map(e=>e.getBoundingClientRect().width));

  const art=page.locator('#how-it-works .explainer-art');
  await art.scrollIntoViewIfNeeded();

  await expect.poll(()=>page.evaluate(()=>{
    const inners=Array.from(document.querySelectorAll('#how-it-works [data-emblem-inner]'));
    return inners.map(inner=>{
      const anims=inner.getAnimations();
      if(!anims.length)return null;
      const opt=anims[0]!.effect?.getTiming();
      return {duration:opt?.duration,delay:opt?.delay};
    });
  }),{intervals:[20,50,100]}).toEqual([
    {duration:320,delay:0},{duration:320,delay:80},{duration:320,delay:160},
  ]);

  const slotsAfter=await slots.evaluateAll(els=>els.map(e=>e.getBoundingClientRect().width));
  expect(slotsAfter).toEqual(initialSlotWidths);

  // Observe completion of the initial reveal before testing re-entry.
  await page.evaluate(()=>Promise.all(
    Array.from(document.querySelectorAll('#how-it-works [data-emblem-inner]')).flatMap(i=>i.getAnimations().map(a=>a.finished))
  ));

  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
  await expect(art).not.toBeInViewport();

  // Scroll back into view. The arrival must not replay.
  await art.scrollIntoViewIfNeeded();
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  const replayAnimations=await page.evaluate(()=>{
    const inners=Array.from(document.querySelectorAll('#how-it-works [data-emblem-inner]'));
    return inners.flatMap(i=>i.getAnimations().filter(a=>a.playState==='running')).length;
  });
  expect(replayAnimations).toBe(0);
  await context.close();
});

test('6. focusing or selecting text during arrival settles graphics without clearing focus/selection',async({browser})=>{
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();
  await page.goto(site.url);
  await page.keyboard.press('Escape');

  await page.locator('#how-it-works').scrollIntoViewIfNeeded();
  const paragraph=page.locator('#how-it-works .explainer-body');
  await paragraph.click();

  await page.evaluate(()=>{
    const p=document.querySelector('#how-it-works .explainer-body');
    if(!p)return;
    const range=document.createRange();
    range.selectNodeContents(p);
    const sel=window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    p.dispatchEvent(new Event('focusin',{bubbles:true}));
  });

  const selectionText=await page.evaluate(()=>window.getSelection()?.toString());
  expect(selectionText).toContain('Keep your agent’s work in view');

  const running=await page.evaluate(()=>{
    const inners=Array.from(document.querySelectorAll('#how-it-works [data-emblem-inner]'));
    return inners.flatMap(i=>i.getAnimations().filter(a=>a.playState==='running')).length;
  });
  expect(running).toBe(0);
  await context.close();
});

for(const {width,height} of [
  {width:600,height:900},
  {width:1024,height:900},
  {width:1440,height:900},
  {width:1920,height:1080},
  {width:1440,height:600},
]){
  test(`7. responsive composition at ${width}x${height} has no horizontal overflow and unobstructed walkthrough`,async({browser})=>{
    const context=await browser.newContext({viewport:{width,height}});
    const page=await context.newPage();
    await page.goto(site.url+'/#how-it-works');
    await page.evaluate(()=>document.fonts.ready);

    const noOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
    expect(noOverflow).toBe(true);

    const copyBox=await page.locator('#how-it-works .explainer-copy').boundingBox();
    const artBox=await page.locator('#how-it-works .explainer-art').boundingBox();
    expect(copyBox).not.toBeNull();
    expect(artBox).not.toBeNull();

    if(width>=1024){
      expect(artBox!.x).toBeGreaterThan(copyBox!.x);
    }else{
      expect(artBox!.y).toBeGreaterThanOrEqual(copyBox!.y);
    }

    const session=page.locator('#session');
    await expect(session).toBeVisible();
    const sessionBox=await session.boundingBox();
    expect(sessionBox).not.toBeNull();
    expect(sessionBox!.y).toBeGreaterThan(artBox!.y);

    await context.close();
  });
}

test('hero logo stays proportional and clear of the preview when resized',async({page})=>{
  const mark=page.locator('.identity-sculpture');
  const preview=page.locator('.hero-world .product-scene');
  await page.setViewportSize({width:600,height:900});
  await page.goto(site.url+'/#main');
  let previousWidth=0;
  for(const [width,height] of [[600,900],[1024,600],[1920,1080]]){
    await page.setViewportSize({width,height});
    const markBox=(await mark.boundingBox())!;
    const previewBox=(await preview.boundingBox())!;
    expect(markBox.width/markBox.height).toBeCloseTo(460/430,2);
    expect(markBox.width).toBeGreaterThan(previousWidth);
    expect(markBox.y+markBox.height).toBeLessThanOrEqual(previewBox.y);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    previousWidth=markBox.width;
  }
});
