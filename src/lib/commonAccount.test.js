import { describe, it, expect } from 'vitest';
import { appendReimbursement, pendingCents, validateReimbursedEdit } from './commonAccount';
import { flattenBankImports } from './bankImport';

const expense = { id: 'e1', chargeTo: 'common', amount: 80, payerId: 'u1', category: 'dining', date: '2026-08-12' };
const payment = { id: 'p1', amountCents: 3000, date: '2026-09-28' };

describe('Common account reimbursements', () => {
    it('carries the full outstanding amount across months and supports partial payments', () => {
        const partial = { ...expense, reimbursements: appendReimbursement(expense, payment) };
        expect(pendingCents(partial)).toBe(5000);
        expect(pendingCents({ ...partial, reimbursements: appendReimbursement(partial, { ...payment, id: 'p2', amountCents: 5000 }) })).toBe(0);
        expect(pendingCents({ amount: 80 })).toBe(0);
    });
    it('deduplicates retries and rejects overpayments or invalid amounts', () => {
        const partial = { ...expense, reimbursements: [payment] };
        expect(appendReimbursement(partial, payment)).toEqual([payment]);
        for (const amountCents of [5001, 0, -1, NaN, 0.1]) {
            expect(() => appendReimbursement(partial, { ...payment, id: 'p2', amountCents })).toThrow();
        }
        expect(() => appendReimbursement({ ...expense, chargeTo: 'people' }, payment)).toThrow();
        expect(() => appendReimbursement(expense, { ...payment, date: '2026-08-01' })).toThrow();
    });
    it('protects recorded reimbursements when editing an expense', () => {
        const partial = { ...expense, reimbursements: [payment] };
        for (const patch of [{ amount: 29 }, { chargeTo: 'people' }, { payerId: 'u2' }, { category: 'settlement' }]) {
            expect(() => validateReimbursedEdit(partial, patch)).toThrow();
        }
        expect(() => validateReimbursedEdit(partial, { amount: 30, title: 'Cena' })).not.toThrow();
    });
    it('excludes imported reimbursements from spending without removing ordinary purchases', () => {
        const entries = [{ amount: 80, category: 'dining' }, { amount: 80, category: 'cm_reimbursement' }];
        expect(flattenBankImports([{ id: 'r1', entries }])).toHaveLength(1);
        expect(entries).toHaveLength(2);
    });
});
