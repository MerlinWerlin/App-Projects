// fb-1023b: the Trade & workshop pack is Linework Plus only (the 14-day trial previews it).
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../core/templates.ts';
import { trade } from '../core/templateArt/trade.ts';
import { accessFor, starterIds, templateLocked } from './access.ts';
import { STARTER_TEMPLATE_COUNT } from './entitlement.ts';

test('trade: Linework Plus only after the trial, never a free starter', () => {
  const starters = starterIds(TEMPLATES, STARTER_TEMPLATE_COUNT);
  const expired = accessFor(false, 0, 100 * 86_400_000);
  const trial = accessFor(false, 0, 0);
  for (const t of trade) {
    assert.ok(!starters.has(t.id), `${t.id} is a starter`);
    assert.equal(templateLocked(expired, starters, t.id), true, t.id);
    assert.equal(templateLocked(trial, starters, t.id), false, t.id);
  }
});

