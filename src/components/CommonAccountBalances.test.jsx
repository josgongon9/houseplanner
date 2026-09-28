import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CommonAccountBalances from './CommonAccountBalances';
import { settleCommonMonth, undoCommonSettlement } from '../lib/commonAccountRepository';
vi.mock('../lib/commonAccountRepository', () => ({ settleCommonMonth: vi.fn(), undoCommonSettlement: vi.fn() }));
const expenses = [
    { id: 'e1', title: 'Cena agosto', amount: 80, payerId: 'u1', chargeTo: 'common', date: '2026-08-01', reimbursements: [{ id: 'p0', date: '2026-08-10', amountCents: 1000 }] },
    { id: 'e2', title: 'Compra agosto', amount: 20, payerId: 'u1', chargeTo: 'common', date: '2026-08-02' },
    { id: 'e3', title: 'Compra julio', amount: 99, payerId: 'u1', chargeTo: 'common', date: '2026-07-02' }
];
const props = { expenses, members: [{ id: 'u1', displayName: 'Jose' }], householdId: 'h1', userId: 'u1', month: new Date(2026, 7, 1) };
describe('Monthly common account balances', () => {
    beforeEach(() => { vi.resetAllMocks(); vi.spyOn(window, 'confirm').mockReturnValue(true); });
    it('shows one monthly amount and settles every included advance in one action', async () => {
        render(<CommonAccountBalances {...props} />);
        expect(screen.queryByText('Cena agosto')).not.toBeInTheDocument();
        expect(screen.queryByText('Compra agosto')).not.toBeInTheDocument();
        expect(screen.getByText('+90.00€')).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'MARCAR COMO PAGADO' })).toHaveLength(1);
        fireEvent.click(screen.getByRole('button', { name: 'MARCAR COMO PAGADO' }));
        await waitFor(() => expect(settleCommonMonth).toHaveBeenCalledWith('h1', 'u1', '2026-08', [{ id: 'e1', amountCents: 7000 }, { id: 'e2', amountCents: 2000 }], expect.objectContaining({ createdBy: 'u1' })));
    });
    it('respects month navigation without losing older pending balances', () => {
        const view = render(<CommonAccountBalances {...props} />);
        view.rerender(<CommonAccountBalances {...props} month={new Date(2026, 6, 1)} />);
        expect(screen.getByText('+99.00€')).toBeInTheDocument();
        expect(screen.queryByText('+90.00€')).not.toBeInTheDocument();
        view.rerender(<CommonAccountBalances {...props} month={new Date(2026, 8, 1)} />);
        expect(screen.getByText('Este mes está liquidado con la CM.')).toBeInTheDocument();
    });
    it('does not settle when cancelled and surfaces failed writes', async () => {
        window.confirm.mockReturnValueOnce(false);
        settleCommonMonth.mockRejectedValueOnce(new Error('Sin conexión'));
        render(<CommonAccountBalances {...props} />);
        fireEvent.click(screen.getByRole('button', { name: 'MARCAR COMO PAGADO' }));
        expect(settleCommonMonth).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'MARCAR COMO PAGADO' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
        expect(screen.getByText('+90.00€')).toBeInTheDocument();
    });
    it('groups a settlement across advances and undoes it as one payment', async () => {
        const settled = expenses.slice(0, 2).map(expense => ({ ...expense, reimbursements: [{ id: 'batch1', date: '2026-08-28', amountCents: expense.amount * 100 }] }));
        render(<CommonAccountBalances {...props} expenses={settled} />);
        expect(screen.getByText('Liquidaciones de la CM (1)')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Liquidaciones de la CM (1)'));
        fireEvent.click(screen.getByRole('button', { name: 'Anular liquidación' }));
        await waitFor(() => expect(undoCommonSettlement).toHaveBeenCalledWith('h1', ['e1', 'e2'], 'batch1'));
    });
});
