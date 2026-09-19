import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateDueRecurringExpenses } from './recurringExpenses';
import { getDocs, runTransaction } from './firebase';
vi.mock('./firebase', () => ({ db: {}, collection: (_, name) => name, query: (...args) => args, where: vi.fn(), doc: (_, ...parts) => parts.join('/'), getDocs: vi.fn(), runTransaction: vi.fn() }));
const rule = { title: 'Alquiler', amount: 800, category: 'home', payerId: 'u1', splitAmong: ['u1', 'u2'], startMonth: '2026-09', endMonth: null, householdId: 'h1', active: true };
const snapshot = items => ({ docs: items.map(([id, data]) => ({ id, data: () => data })) });

describe('Recurring expense due dates', () => {
    beforeEach(() => vi.resetAllMocks());
    it('does not query or write a future month, including across years', async () => {
        await generateDueRecurringExpenses('h1', new Date(2026, 9, 1), new Date(2026, 8, 30, 23, 59));
        await generateDueRecurringExpenses('h1', new Date(2027, 0, 1), new Date(2026, 11, 31));
        expect(getDocs).not.toHaveBeenCalled();
        expect(runTransaction).not.toHaveBeenCalled();
    });
    it('generates on the first or on a later opening with date set to the first, without duplicating retries', async () => {
        getDocs.mockImplementation(async q => q[0] === 'recurringExpenses' ? snapshot([['r1', rule]]) : snapshot([]));
        const saved = new Map();
        const set = vi.fn((ref, value) => saved.set(ref, value));
        runTransaction.mockImplementation(async (_, action) => action({ get: async ref => ref.startsWith('recurringExpenses/') ? { exists: () => true, data: () => rule } : { exists: () => saved.has(ref) }, set }));
        await generateDueRecurringExpenses('h1', new Date(2026, 9, 1), new Date(2026, 9, 1));
        await generateDueRecurringExpenses('h1', new Date(2026, 9, 8), new Date(2026, 9, 8));
        expect(set).toHaveBeenCalledOnce();
        const value = [...saved.values()][0];
        expect(new Date(value.date).getDate()).toBe(1);
        expect(new Date(value.date).getMonth()).toBe(9);
        expect(value).toMatchObject({ recurringMonth: '2026-10', amount: 800, payerId: 'u1', splitAmong: ['u1', 'u2'] });
    });
    it('respects start/end dates and already-generated legacy entries', async () => {
        getDocs.mockResolvedValueOnce(snapshot([['old', rule], ['future', { ...rule, startMonth: '2026-11' }], ['ended', { ...rule, endMonth: '2026-09' }]]))
            .mockResolvedValueOnce(snapshot([['random-id', { recurringId: 'old', recurringMonth: '2026-10' }]]));
        await generateDueRecurringExpenses('h1', new Date(2026, 9, 1), new Date(2026, 9, 1));
        expect(runTransaction).not.toHaveBeenCalled();
    });
});
