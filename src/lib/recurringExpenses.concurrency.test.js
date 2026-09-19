import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateDueRecurringExpenses } from './recurringExpenses';
import { getDocs, runTransaction } from './firebase';

vi.mock('./firebase', () => ({
    db: {}, collection: (_, name) => name, query: (...args) => args,
    where: (field, op, value) => ({ field, op, value }), doc: (_, ...parts) => parts.join('/'),
    getDocs: vi.fn(), runTransaction: vi.fn()
}));
const month = new Date(2026, 9, 1);
const rule = { householdId: 'h1', active: true, title: 'Alquiler', amount: 800, category: 'home', payerId: 'u1', splitAmong: ['u1', 'u2'], startMonth: '2026-01' };

// Deterministic optimistic-transaction simulation, not a Firestore emulator.
// Stage all writes, check every read version on commit, retry conflicts.
// A barrier makes ALL clients finish their first reads before ANY commits.
function concurrentDatabase(participants, beforeFirstCommit) {
    const values = new Map([['recurringExpenses/r1', { ...rule }]]);
    const versions = new Map();
    let release;
    const barrier = new Promise(resolve => { release = resolve; });
    let arrivals = 0, attempts = 0, commits = 0, firstCommit = true;
    const put = (ref, data) => { values.set(ref, data); versions.set(ref, (versions.get(ref) || 0) + 1); };
    getDocs.mockImplementation(async ([collection, filter]) => ({
        docs: collection === 'recurringExpenses' ? [...values.entries()]
            .filter(([ref, data]) => ref.startsWith('recurringExpenses/') && data?.householdId === filter.value && data.active)
            .map(([ref, data]) => ({ id: ref.split('/')[1], data: () => ({ ...data }) })) : []
    }));
    runTransaction.mockImplementation(async (_, action) => {
        for (let attempt = 0; attempt < 10; attempt++) {
            attempts++;
            const reads = new Map(), writes = new Map();
            await action({
                get: async ref => {
                    reads.set(ref, versions.get(ref) || 0);
                    const value = values.get(ref);
                    return { exists: () => value !== undefined, data: () => ({ ...value }) };
                },
                set: (ref, value) => writes.set(ref, value)
            });
            if (attempt === 0) {
                arrivals++;
                if (arrivals === participants) release();
                await barrier;
            }
            if (firstCommit) { firstCommit = false; beforeFirstCommit?.(put); }
            if ([...reads].some(([ref, version]) => (versions.get(ref) || 0) !== version)) continue;
            for (const [ref, value] of writes) { put(ref, value); commits++; }
            return;
        }
        throw new Error('Transaction retry limit');
    });
    return { values, put, stats: () => ({ attempts, commits, arrivals }), expenses: () => [...values.entries()].filter(([ref]) => ref.startsWith('expenses/')) };
}

describe('Concurrent recurring expense generation', () => {
    beforeEach(() => vi.resetAllMocks());

    it('20 simultaneous clients create exactly ONE expense without overwriting it', async () => {
        const database = concurrentDatabase(20);
        await Promise.all(Array.from({ length: 20 }, () => generateDueRecurringExpenses('h1', month, month)));
        expect(database.stats()).toEqual({ arrivals: 20, attempts: 39, commits: 1 });
        expect(database.expenses()).toHaveLength(1);
        expect(database.expenses()[0][1]).toMatchObject({ amount: 800, recurringId: 'r1', recurringMonth: '2026-10' });
        // A later retry must not overwrite an expense edited after generation.
        database.put(database.expenses()[0][0], { ...database.expenses()[0][1], amount: 750 });
        await generateDueRecurringExpenses('h1', month, month);
        expect(database.expenses()[0][1].amount).toBe(750);
        expect(database.stats().commits).toBe(1);
    });

    it.each([
        ['paused', { ...rule, active: false }],
        ['deleted', undefined],
        ['moved to another household', { ...rule, householdId: 'h2' }],
        ['postponed', { ...rule, startMonth: '2026-11' }],
        ['ended', { ...rule, endMonth: '2026-09' }]
    ])('does not create an expense if the rule is %s during the transaction', async (_, updated) => {
        const database = concurrentDatabase(2, put => put('recurringExpenses/r1', updated));
        await Promise.all([generateDueRecurringExpenses('h1', month, month), generateDueRecurringExpenses('h1', month, month)]);
        expect(database.expenses()).toHaveLength(0);
        expect(database.stats()).toEqual({ arrivals: 2, attempts: 4, commits: 0 });
    });

    it('retries using the updated amount when someone edits the rule during generation', async () => {
        const database = concurrentDatabase(2, put => put('recurringExpenses/r1', { ...rule, amount: 900 }));
        await Promise.all([generateDueRecurringExpenses('h1', month, month), generateDueRecurringExpenses('h1', month, month)]);
        expect(database.expenses()).toHaveLength(1);
        expect(database.expenses()[0][1].amount).toBe(900);
        expect(database.stats().commits).toBe(1);
    });

    it('keeps separate rules, households and months independent', async () => {
        const database = concurrentDatabase(1);
        database.put('recurringExpenses/r2', { ...rule, title: 'Internet' });
        database.put('recurringExpenses/r3', { ...rule, householdId: 'h2' });
        await generateDueRecurringExpenses('h1', month, month);
        await generateDueRecurringExpenses('h2', month, month);
        const next = new Date(2026, 10, 1);
        await generateDueRecurringExpenses('h1', next, next);
        expect(database.expenses()).toHaveLength(5);
        expect(new Set(database.expenses().map(([ref]) => ref)).size).toBe(5);
    });
});
