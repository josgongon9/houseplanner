import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Expenses from '../pages/Expenses';
import * as StoreContext from '../context/StoreContext';

// Mock the context hook
vi.mock('../context/StoreContext', () => ({
    useStore: vi.fn(),
}));

describe('Expenses Component', () => {
    const mockUser = { uid: 'user1', displayName: 'Jose Admin' };
    const mockMembers = [
        { id: 'user1', displayName: 'Jose Admin', photoURL: null },
        { id: 'user2', displayName: 'Maria User', photoURL: null }
    ];

    // Use CURRENT date so it shows up in the default view (Current Month)
    const mockExpenses = [
        {
            id: 'exp1',
            title: 'Pizza',
            amount: 10,
            category: 'dining',
            date: new Date().toISOString(),
            payerId: 'user1',
            splitAmong: ['user1', 'user2']
        }
    ];

    it('renders expenses list correctly', () => {
        StoreContext.useStore.mockReturnValue({
            expenses: mockExpenses,
            householdMembers: mockMembers,
            user: mockUser,
            addExpense: vi.fn()
        });

        render(<Expenses />);

        // Check visible title
        expect(screen.getByText('Gastos')).toBeInTheDocument();

        // Check expense item
        expect(screen.getByText('Pizza')).toBeInTheDocument();
        // The amount might be formatted
        expect(screen.getByText('10.00€')).toBeInTheDocument();
        expect(screen.getByText(/Pagó Jose/)).toBeInTheDocument();
    });

    it('calculates and shows balances correctly', () => {
        StoreContext.useStore.mockReturnValue({
            expenses: mockExpenses,
            householdMembers: mockMembers,
            user: mockUser,
            addExpense: vi.fn()
        });

        render(<Expenses />);

        // Switch to Balances tab
        const balancesTab = screen.getByText(/Saldos/i);
        fireEvent.click(balancesTab);

        // Jose paid 10, split by 2 = 5 each.
        // Jose: Paid 10, Consumed 5 = +5 balance
        // Maria: Paid 0, Consumed 5 = -5 balance

        // Look for positive balance for Jose
        expect(screen.getByText('+5.00€')).toBeInTheDocument();

        // Look for negative balance for Maria
        expect(screen.getByText('-5.00€')).toBeInTheDocument();
    });

    it('shows debt liquidation message', () => {
        StoreContext.useStore.mockReturnValue({
            expenses: mockExpenses,
            householdMembers: mockMembers,
            user: mockUser,
            addExpense: vi.fn()
        });

        render(<Expenses />);
        fireEvent.click(screen.getByText(/Saldos/i));

        // Maria (user2) pays Jose (user1) 5€
        expect(screen.getByText(/paga a/i)).toBeInTheDocument();

        // "Jose" appears in Balances list AND inside the transaction card now. 
        // So we expect multiple or at least one.
        const joseInstances = screen.getAllByText('Jose');
        expect(joseInstances.length).toBeGreaterThan(0);

        const amounts = screen.getAllByText('5.00€');
        expect(amounts.length).toBeGreaterThanOrEqual(1);
    });
});
