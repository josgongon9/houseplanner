import { beforeEach, describe, expect, it, vi } from 'vitest';
import { settleCommonMonth } from './commonAccountRepository';
import { editExpenseRecord } from './expenseRepository';
import { pendingCents } from './commonAccount';
import { runTransaction } from './firebase';
vi.mock('./firebase', () => ({ db: {}, doc: (_, ...parts) => parts.join('/'), runTransaction: vi.fn() }));

// Deterministic optimistic transaction simulation. No writes commit until all
// first attempts read; conflicting readers then retry against committed data.
function database() {
    let record = { householdId: 'h1', chargeTo: 'common', amount: 80, category: 'home', payerId: 'u1', splitAmong: ['u1', 'u2'], splitMode: 'equal', date: '2026-08-01' };
    let version = 0, arrivals = 0, release;
    const barrier = new Promise(resolve => { release = resolve; });
    runTransaction.mockImplementation(async (_, action) => {
        for (let attempt = 0; attempt < 5; attempt++) {
            const readVersion = version;
            const current = structuredClone(record);
            let staged;
            await action({ get: async () => ({ exists: () => true, data: () => current }), update: (_, payload) => { staged = payload; } });
            if (attempt === 0) { if (++arrivals === 2) release(); await barrier; }
            if (readVersion !== version) continue;
            if (staged) { record = { ...record, ...staged }; version++; }
            return;
        }
        throw new Error('Retry limit');
    });
    return () => record;
}
const payment = id => ({ id, date: '2026-09-28', createdBy: 'u1' });
const settle = id => settleCommonMonth('h1', 'u1', '2026-08', [{ id: 'e1', amountCents: 8000 }], payment(id));
describe('Concurrent settlement and expense edits', () => {
    beforeEach(() => vi.resetAllMocks());
    it('allows only one of two distinct payments against the same pending balance', async () => {
        const record = database();
        const results = await Promise.allSettled([settle('a'), settle('b')]);
        expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        expect(record().reimbursements).toHaveLength(1);
        expect(pendingCents(record())).toBe(0);
    });
    it('deduplicates simultaneous retries of the same payment', async () => {
        const record = database();
        const results = await Promise.allSettled([settle('a'), settle('a')]);
        expect(results.every(result => result.status === 'fulfilled')).toBe(true);
        expect(record().reimbursements).toHaveLength(1);
    });
    it.each([{ chargeTo: 'people' }, { payerId: 'u2' }, { amount: 20 }])('never commits both an incompatible edit and payment: %j', async patch => {
        const record = database();
        const results = await Promise.allSettled([editExpenseRecord('h1', 'e1', patch), settle('a')]);
        expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        if (record().reimbursements?.length) {
            expect(record()).toMatchObject({ chargeTo: 'common', payerId: 'u1', amount: 80 });
        } else {
            expect(record()).toMatchObject(patch);
        }
    });
});
