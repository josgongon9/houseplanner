import { describe, it, expect } from 'vitest';
import { expenseAllocation, validateExpenseAllocation } from './expenseAllocation';
const members = [{ id: 'u1' }, { id: 'u2' }];
describe('Allocation when moving between people and CM', () => {
    it('clears personal custom allocations when moving to CM', () => {
        expect(expenseAllocation({ chargeTo: 'common', splitAmong: ['u2'], splitMode: 'custom', customAmounts: { u2: 80 } }, members)).toEqual({ chargeTo: 'common', splitAmong: ['u1', 'u2'], splitMode: 'equal', customAmounts: {} });
    });
    it('derives personal beneficiaries from custom amounts', () => {
        expect(expenseAllocation({ chargeTo: 'people', splitAmong: ['u1'], splitMode: 'custom', customAmounts: { u1: 0, u2: 80 } }, members).splitAmong).toEqual(['u2']);
    });
    it.each([NaN, Infinity, -1, 0])('rejects invalid total %s', amount => {
        expect(() => validateExpenseAllocation({ amount, payerId: 'u1', splitAmong: ['u1'] })).toThrow();
    });
    it.each([{ u1: -1, u2: 81 }, { u1: 40, u2: 39.99 }, { u1: NaN }, { u1: 80, stranger: 10 }])('rejects an invalid distribution %j', customAmounts => {
        expect(() => validateExpenseAllocation({ amount: 80, payerId: 'u1', splitAmong: ['u1', 'u2'], splitMode: 'custom', customAmounts })).toThrow();
    });
});
