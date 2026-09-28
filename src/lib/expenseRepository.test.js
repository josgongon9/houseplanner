import { describe, beforeEach, it, expect, vi } from 'vitest';
import { editExpenseRecord, deleteExpenseRecord, editRecurringRecord } from './expenseRepository';
import { runTransaction } from './firebase';
import { pendingCents } from './commonAccount';
vi.mock('./firebase', () => ({ db: {}, doc: (_, ...parts) => parts.join('/'), runTransaction: vi.fn() }));
const base = { householdId: 'h1', chargeTo: 'common', amount: 80, category: 'home', payerId: 'u1', splitMode: 'equal', splitAmong: ['u1', 'u2'], date: '2026-08-01' };
describe('Expense edits use current persisted balances', () => {
    let record, update, remove;
    beforeEach(() => {
        record = { ...base };
        update = vi.fn((ref, payload) => { record = { ...record, ...payload }; });
        remove = vi.fn();
        runTransaction.mockImplementation(async (_, action) => action({ get: async () => ({ exists: () => true, data: () => record }), update, delete: remove }));
    });
    it('moves unpaid expenses in both directions and transfers the CM claim to another payer', async () => {
        await editExpenseRecord('h1', 'e1', { chargeTo: 'people' });
        expect(pendingCents(record)).toBe(0);
        await editExpenseRecord('h1', 'e1', { chargeTo: 'common', payerId: 'u2', amount: 90 });
        expect(pendingCents(record)).toBe(9000);
        expect(record.payerId).toBe('u2');
    });
    it.each([{ chargeTo: 'people' }, { payerId: 'u2' }, { amount: 29 }, { date: '2026-09-01' }, { category: 'settlement' }])('rejects an edit conflicting with reimbursements: %j', async patch => {
        record.reimbursements = [{ id: 'p1', amountCents: 3000 }];
        await expect(editExpenseRecord('h1', 'e1', patch)).rejects.toThrow();
        expect(update).not.toHaveBeenCalled();
    });
    it('keeps payments when changing description or amount, and computes only the remainder', async () => {
        record.reimbursements = [{ id: 'p1', amountCents: 8000 }];
        await editExpenseRecord('h1', 'e1', { amount: '95.25', title: 'Corregido' });
        expect(pendingCents(record)).toBe(1525);
        expect(record.reimbursements).toHaveLength(1);
        await expect(deleteExpenseRecord('h1', 'e1')).rejects.toThrow();
        expect(remove).not.toHaveBeenCalled();
        record.reimbursements = [];
        await editExpenseRecord('h1', 'e1', { chargeTo: 'people' });
        await deleteExpenseRecord('h1', 'e1');
        expect(remove).toHaveBeenCalledOnce();
    });
    it('rejects invalid custom allocations, including a single cent difference', async () => {
        await expect(editExpenseRecord('h1', 'e1', { chargeTo: 'people', splitMode: 'custom', customAmounts: { u1: 40, u2: 39.99 } })).rejects.toThrow();
        expect(update).not.toHaveBeenCalled();
    });
    it('only updates the recurring rule, never its generated expenses', async () => {
        await editRecurringRecord('h1', 'r1', { chargeTo: 'people' });
        expect(update).toHaveBeenCalledExactlyOnceWith('recurringExpenses/r1', { chargeTo: 'people' });
    });
    it('rejects access to another household for expense edits, deletion and rule edits', async () => {
        await expect(editExpenseRecord('h2', 'e1', { chargeTo: 'people' })).rejects.toThrow();
        await expect(deleteExpenseRecord('h2', 'e1')).rejects.toThrow();
        await expect(editRecurringRecord('h2', 'r1', { chargeTo: 'people' })).rejects.toThrow();
        expect(update).not.toHaveBeenCalled();
        expect(remove).not.toHaveBeenCalled();
    });
});
