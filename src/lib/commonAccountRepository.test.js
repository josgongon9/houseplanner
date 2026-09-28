import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveCommonReimbursement, removeCommonReimbursement, settleCommonMonth, undoCommonSettlement } from './commonAccountRepository';
import { runTransaction } from './firebase';
vi.mock('./firebase', () => ({ db: {}, doc: (_, ...parts) => parts.join('/'), runTransaction: vi.fn() }));

describe('Transactional reimbursements', () => {
    let expense;
    beforeEach(() => {
        expense = { householdId: 'h1', amount: 80, chargeTo: 'common', date: '2026-08-01', reimbursements: [] };
        runTransaction.mockImplementation(async (_, action) => action({
            get: async () => ({ exists: () => true, data: () => expense }),
            update: (_, payload) => { expense = { ...expense, ...payload }; }
        }));
    });
    it('checks the latest balance, deduplicates retries, and allows cancellation', async () => {
        const payment = { id: 'p1', amountCents: 6000, date: '2026-09-28' };
        await saveCommonReimbursement('h1', 'e1', payment);
        await saveCommonReimbursement('h1', 'e1', payment);
        expect(expense.reimbursements).toHaveLength(1);
        await expect(saveCommonReimbursement('h1', 'e1', { ...payment, id: 'p2', amountCents: 3000 })).rejects.toThrow();
        await removeCommonReimbursement('h1', 'e1', 'p1');
        expect(expense.reimbursements).toEqual([]);
    });
    it('rejects writes to expenses in another household', async () => {
        await expect(saveCommonReimbursement('h2', 'e1', { id: 'p1', amountCents: 100, date: '2026-09-28' })).rejects.toThrow();
        await expect(removeCommonReimbursement('h2', 'e1', 'p1')).rejects.toThrow();
        expect(expense.reimbursements).toEqual([]);
    });
});

describe('Atomic monthly CM settlement', () => {
    const payment = { id: 'batch', amountCents: 0, date: '2026-09-28' };
    let data, update;
    beforeEach(() => {
        data = new Map(['a', 'b'].map(id => [`expenses/${id}`, { householdId: 'h1', payerId: 'u1', chargeTo: 'common', date: '2026-08-01', amount: 20 }]));
        update = vi.fn((ref, payload) => data.set(ref, { ...data.get(ref), ...payload }));
        runTransaction.mockImplementation(async (_, action) => action({ get: async ref => ({ exists: () => data.has(ref), data: () => data.get(ref) }), update }));
    });
    it('settles multiple expenses, retries without duplicating and cancels together', async () => {
        const items = [{ id: 'a', amountCents: 2000 }, { id: 'b', amountCents: 2000 }];
        await settleCommonMonth('h1', 'u1', '2026-08', items, payment);
        await settleCommonMonth('h1', 'u1', '2026-08', items, payment);
        expect(update).toHaveBeenCalledTimes(2);
        expect(data.get('expenses/a').reimbursements).toHaveLength(1);
        await undoCommonSettlement('h1', ['a', 'b'], 'batch');
        expect(data.get('expenses/a').reimbursements).toEqual([]);
        expect(data.get('expenses/b').reimbursements).toEqual([]);
    });
    it.each([
        { amount: 30 }, { payerId: 'u2' }, { householdId: 'h2' }, { date: '2026-07-01' }, { chargeTo: 'people' }
    ])('does not write any payment if an included advance changed: %j', async changes => {
        data.set('expenses/b', { ...data.get('expenses/b'), ...changes });
        await expect(settleCommonMonth('h1', 'u1', '2026-08', [{ id: 'a', amountCents: 2000 }, { id: 'b', amountCents: 2000 }], payment)).rejects.toThrow();
        expect(update).not.toHaveBeenCalled();
    });
});
