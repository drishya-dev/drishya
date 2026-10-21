import { expect, it } from 'vitest';
import { boundResults, searchLinks } from '../src/reduce.ts';

// CONTENT-2: recorded search results become a bounded list; nothing is guessed or fetched.
it("reads Claude's recorded links, whole pairs only, with escaped characters", () => {
  const text = 'Web search results for query: "poisoning"\n\nLinks: [{"title":"Back to the \\"Drawing\\" Board","url":"https://paperswithcode.com/paper/back"},{"title":"SPoiL","url":"https://link.springer.com/x"},{"title":"Cut off","url":"https://exa';
  const links = searchLinks(text)!;
  expect(links.map((l) => l.title)).toEqual(['Back to the "Drawing" Board', 'SPoiL']);
  expect(links[1]!.domain).toBe('link.springer.com');
  expect(searchLinks('no links here')).toBeUndefined();
});

it('keeps only http(s) links, at most 20, with short fields', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ url: `https://a.example/${i}`, title: 'x'.repeat(400), snippet: 's'.repeat(900) }));
  const kept = boundResults([{ url: 'javascript:alert(1)' }, { url: 'file:///etc/passwd' }, ...many])!;
  expect(kept).toHaveLength(20);
  expect(kept[0]!.url).toBe('https://a.example/0');
  expect(kept[0]!.title!.length).toBeLessThanOrEqual(200);
  expect(kept[0]!.snippet!.length).toBeLessThanOrEqual(300);
  expect(boundResults([{ url: 'mailto:x@y' }])).toBeUndefined();
});
