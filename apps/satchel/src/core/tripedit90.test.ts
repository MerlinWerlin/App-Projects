import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tripFromDraft } from './trips.ts';
import type { Trip } from './model.ts';

test('editing a trip keeps its journal, ideas, companions and settlements', () => {
  const prev = {
    id: 'trip_1', name: 'Old', startDate: '2027-01-01', endDate: '2027-01-05', homeTz: 'Australia/Sydney',
    items: [], createdAt: '2026-10-31T00:00:00Z',
    journal: [{ id: 'j1' }], ideas: [{ id: 'i1' }], companions: [{ id: 'c1', name: 'Sam' }], settlements: [{ id: 's1' }],
    cash: { start: [{ currency: 'JPY', amount: 5000 }], paid: [{ expenseId: 'e1' }] },
  } as unknown as Trip;
  const next = tripFromDraft({ name: ' New ', startDate: '2027-01-02', endDate: '2027-01-06', homeTz: 'Australia/Sydney' } as never, prev);
  assert.equal(next.name, 'New');
  assert.equal(next.startDate, '2027-01-02');
  assert.deepEqual((next as unknown as Record<string, unknown>).journal, [{ id: 'j1' }]);
  assert.deepEqual(next.ideas, prev.ideas);
  assert.deepEqual(next.companions, prev.companions);
  assert.deepEqual(next.settlements, prev.settlements);
  assert.deepEqual(next.cash, prev.cash, 'T102: cash on hand survives Edit trip');
});
