import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Expenses from '../pages/Expenses';
import * as StoreContext from '../context/StoreContext';

// Mock the context hook
vi.mock('../context/StoreContext', () => ({
    useStore: vi.fn(),
}));

describe('Expenses Financial Core', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    const members = [
        { id: 'u1', displayName: 'Jose' },
        { id: 'u2', displayName: 'Maria' },
        { id: 'u3', displayName: 'Lucas' }
    ];

    it('calculates complex equal splits correctly', () => {
        const expenses = [
            { id: 'e1', amount: 30, payerId: 'u1', splitAmong: ['u1', 'u2', 'u3'], date: new Date().toISOString() }, // Each owes 10
            { id: 'e2', amount: 20, payerId: 'u2', splitAmong: ['u1', 'u2'], date: new Date().toISOString() }      // Each owes 10
        ];

        StoreContext.useStore.mockReturnValue({
            expenses, recurringExpenses: [], householdMembers: members, user: { uid: 'u1' },
            addExpense: vi.fn(), household: { expenseCategories: [] }
        });

        render(<Expenses />);
        fireEvent.click(screen.getByText(/Saldos/i));

        // Let's analyze balances:
        // E1: U1 paid 30, consumed 10. U2 consumed 10. U3 consumed 10.
        // E2: U2 paid 20, consumed 10. U1 consumed 10.
        // Totals:
        // U1: +30 -10 -10 = +10
        // U2: +20 -10 -10 = 0
        // U3: -10
        // Result: U3 (Lucas) should pay 10 to U1 (Jose).

        expect(screen.getByText('+10.00€')).toBeInTheDocument(); // Jose is owed 10
        expect(screen.getByText('-10.00€')).toBeInTheDocument(); // Lucas owes 10

        // The text "Lucas paga a Jose" is split across multiple spans
        const payers = screen.getAllByText('Lucas');
        const receivers = screen.getAllByText('Jose');
        expect(payers.length).toBeGreaterThan(0);
        expect(receivers.length).toBeGreaterThan(0);
        expect(screen.getByText('paga a')).toBeInTheDocument();
        expect(screen.getByText('10.00€')).toBeInTheDocument();
    });

    it('handles custom splits accurately', () => {
        const expenses = [
            {
                id: 'e1', amount: 100, payerId: 'u1',
                splitMode: 'custom',
                customAmounts: { u1: 20, u2: 80 },
                date: new Date().toISOString()
            }
        ];

        StoreContext.useStore.mockReturnValue({
            expenses, recurringExpenses: [], householdMembers: members, user: { uid: 'u1' },
            addExpense: vi.fn(), household: { expenseCategories: [] }
        });

        render(<Expenses />);
        fireEvent.click(screen.getByText(/Saldos/i));

        // U1 paid 100, owes 20 -> Balance +80
        // U2 owes 80 -> Balance -80
        expect(screen.getByText('+80.00€')).toBeInTheDocument();
        expect(screen.getByText('-80.00€')).toBeInTheDocument();
    });

    it('resolves debts after a settlement', () => {
        const expenses = [
            { id: 'e1', amount: 50, payerId: 'u1', splitAmong: ['u1', 'u2'], date: new Date().toISOString() }, // U2 owes U1 25€
            { id: 's1', amount: 25, payerId: 'u2', splitAmong: ['u1'], category: 'settlement', date: new Date().toISOString() } // U2 pays U1 25€
        ];

        StoreContext.useStore.mockReturnValue({
            expenses, recurringExpenses: [], householdMembers: members, user: { uid: 'u1' },
            addExpense: vi.fn(), household: { expenseCategories: [] }
        });

        render(<Expenses />);
        fireEvent.click(screen.getByText(/Saldos/i));

        // After settlement, balances should be 0.
        expect(screen.getByText(/Todo cuadrado/i)).toBeInTheDocument();
    });

    it('is robust against floating point errors', () => {
        // 0.1 + 0.2 in JS is 0.30000000000000004
        const expenses = [
            { id: 'e1', amount: 0.1, payerId: 'u1', splitAmong: ['u2'], date: new Date().toISOString() },
            { id: 'e2', amount: 0.2, payerId: 'u1', splitAmong: ['u2'], date: new Date().toISOString() }
        ];

        StoreContext.useStore.mockReturnValue({
            expenses, recurringExpenses: [], householdMembers: members, user: { uid: 'u1' },
            addExpense: vi.fn(), household: { expenseCategories: [] }
        });

        render(<Expenses />);
        fireEvent.click(screen.getByText(/Saldos/i));

        // Balance should be exactly 0.30 (or +0.30 and -0.30)
        expect(screen.getByText('+0.30€')).toBeInTheDocument();
        expect(screen.getByText('-0.30€')).toBeInTheDocument();
    });

    it.each([
        { now: new Date(2026, 9, 15, 10), previousMonth: true, title: 'Liquidación septiembre' },
        { now: new Date(2027, 0, 15, 10), previousMonth: true, title: 'Liquidación diciembre' },
        { now: new Date(2026, 9, 15, 10), previousMonth: false, title: 'Liquidación octubre' },
    ])('records $title in the selected month (previousMonth: $previousMonth)', ({ now, previousMonth, title }) => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(now);
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        const expectedDate = previousMonth
            ? new Date(now.getFullYear(), now.getMonth() - 1, 1, 12)
            : now;
        const addExpense = vi.fn();
        const store = {
            expenses: [{
                id: 'e1', title: 'Compra', amount: 50, payerId: 'u1',
                splitAmong: ['u1', 'u2'], date: expectedDate.toISOString(),
            }],
            recurringExpenses: [], householdMembers: members, user: { uid: 'u1' },
            addExpense, household: { expenseCategories: [] },
        };
        StoreContext.useStore.mockReturnValue(store);
        const { container, rerender } = render(<Expenses />);
        if (previousMonth) {
            fireEvent.click(container.querySelector('.lucide-chevron-left').closest('button'));
        }
        fireEvent.click(screen.getByText(/Saldos/i));
        fireEvent.click(screen.getByRole('button', { name: 'MARCAR COMO PAGADO' }));

        expect(addExpense).toHaveBeenCalledExactlyOnceWith(
            title, 25, 'settlement', 'u2', ['u1'], 'equal', {}, expectedDate.toISOString()
        );

        // Simulate the store receiving the saved payment, including its submitted date.
        const [savedTitle, amount, category, payerId, splitAmong, splitMode, customAmounts, date] = addExpense.mock.calls[0];
        StoreContext.useStore.mockReturnValue({
            ...store,
            expenses: [...store.expenses, { id: 's1', title: savedTitle, amount, category, payerId, splitAmong, splitMode, customAmounts, date }],
        });
        rerender(<Expenses />);
        expect(screen.getByText(/Todo cuadrado/i)).toBeInTheDocument();
        if (previousMonth) {
            fireEvent.click(container.querySelector('.lucide-chevron-right').closest('button'));
            expect(screen.getByText(/Todo cuadrado/i)).toBeInTheDocument();
        }
    });
});
