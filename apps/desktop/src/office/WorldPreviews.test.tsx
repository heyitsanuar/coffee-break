import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WorldPreviews } from './WorldPreviews';

describe('informational world previews', () => {
  it('names exactly four ordered worlds, with only Studio Current', () => {
    const html = renderToStaticMarkup(<WorldPreviews />);
    expect(html).toContain('Worlds — current office and future previews');
    expect([...html.matchAll(/class="world-name">([^<]+)/g)].map(m => m[1])).toEqual(['Studio', 'Retro 70s', 'Arcade 80s', 'Cyber 2000']);
    expect(html.match(/class="world-status"/g)).toHaveLength(4);
    expect(html.match(/>Current</g)).toHaveLength(1);
    expect(html.match(/>Preview</g)).toHaveLength(3);
    expect(html).toContain('Studio is the only authored office. Previews reveal visual concepts; they do not switch worlds.');
  });
  it('uses three independent initially closed native disclosures with exact copy and decorative art', () => {
    const html = renderToStaticMarkup(<WorldPreviews />);
    expect(html.match(/<details/g)).toHaveLength(3);
    expect(html.match(/<summary/g)).toHaveLength(3);
    expect(html).not.toMatch(/<details[^>]*\bopen/);
    for (const text of [
      'A warm office concept with amber and brown materials, vintage furniture, and a retro workspace atmosphere.',
      'A playful office concept with purple and magenta accents, arcade-inspired decoration, and a darker illuminated interior.',
      'A cool blue office concept with futuristic lighting and technology-inspired environmental details.',
    ]) expect(html).toContain(text);
    expect(html.match(/Preview only\. This office is not available\. Studio and all agent information remain unchanged\./g)).toHaveLength(3);
    expect(html.match(/alt=""/g)).toHaveLength(4);
    expect(html).not.toMatch(/aria-selected|tablist|radiogroup|<a |<button/);
  });
});
