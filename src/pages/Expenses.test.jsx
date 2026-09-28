import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import Expenses from '../pages/Expenses';
import * as StoreContext from '../context/StoreContext';
import useBankImports from '../hooks/useBankImports';
vi.mock('../hooks/useBankImports', () => ({ default: vi.fn(() => ({ reports: [], loading: false, error: '' })) }));

// Mock the context hook
vi.mock('../context/StoreContext', () => ({
    useStore: vi.fn(),
}));

describe('Expenses Financial Core', () => {
    afterEach(() => {
        useBankImports.mockReturnValue({ reports: [], loading: false, error: '' });
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    const members = [
        { id: 'u1', displayName: 'Jose' },
        { id: 'u2', displayName: 'Maria' },
        { id: 'u3', displayName: 'Lucas' }
    ];

    it('recalculates both balances after moving an expense and changing its payer without changing total spending', () => {
        const expense = { id: 'e1', title: 'Compra', amount: 80, category: 'home', payerId: 'u1', splitAmong: ['u1', 'u2'], date: new Date().toISOString() };
        const store = { expenses: [expense], recurringExpenses: [], householdMembers: members, user: { uid: 'u1' }, household: { id: 'h1' } };
        StoreContext.useStore.mockReturnValue(store);
        const view = render(<Expenses />);
        fireEvent.click(screen.getByText(/Saldos/i));
        expect(screen.getByText('+40.00€')).toBeInTheDocument();
        expect(screen.getByText('Total: 80€')).toBeInTheDocument();
        StoreContext.useStore.mockReturnValue({ ...store, expenses: [{ ...expense, chargeTo: 'common', payerId: 'u2' }] });
        view.rerender(<Expenses />);
        const cm = within(screen.getByRole('region', { name: 'Reembolsos de la cuenta común' }));
        expect(cm.getByText('+80.00€')).toBeInTheDocument();
        expect(screen.queryByText('+40.00€')).not.toBeInTheDocument();
        expect(screen.getByText('Total: 80€')).toBeInTheDocument();
        StoreContext.useStore.mockReturnValue({ ...store, expenses: [{ ...expense, chargeTo: 'people', splitMode: 'custom', customAmounts: { u1: 20, u2: 60 } }] });
        view.rerender(<Expenses />);
        expect(cm.queryByText('+80.00€')).not.toBeInTheDocument();
        expect(screen.getByText('+60.00€')).toBeInTheDocument();
        expect(screen.getByText('-60.00€')).toBeInTheDocument();
        expect(screen.getByText('Total: 80€')).toBeInTheDocument();
    });

    it('retains previous personal settlements when moving their original expense to CM', () => {
        const date = new Date().toISOString();
        StoreContext.useStore.mockReturnValue({ expenses: [
            { id: 'e1', title: 'Compra', amount: 80, category: 'home', payerId: 'u1', splitAmong: ['u1', 'u2'], chargeTo: 'common', date },
            { id: 's1', title: 'Liquidación', amount: 40, category: 'settlement', payerId: 'u2', splitAmong: ['u1'], date }
        ], recurringExpenses: [], householdMembers: members, user: { uid: 'u1' }, household: { id: 'h1' } });
        render(<Expenses />);
        fireEvent.click(screen.getByText(/Saldos/i));
        expect(screen.getByText('+80.00€')).toBeInTheDocument();
        expect(screen.getByText('-40.00€')).toBeInTheDocument();
        expect(screen.getByText('+40.00€')).toBeInTheDocument();
        expect(screen.getByText('Total: 80€')).toBeInTheDocument();
    });

    it('edits a CM expense into a personal expense using a custom split', async () => {
        const updateExpense = vi.fn();
        StoreContext.useStore.mockReturnValue({ expenses: [{ id: 'e1', title: 'Cena CM', amount: 80, category: 'dining', chargeTo: 'common', payerId: 'u1', splitMode: 'equal', splitAmong: ['u1', 'u2'], date: new Date().toISOString() }], recurringExpenses: [], householdMembers: members, user: { uid: 'u1' }, household: { id: 'h1' }, updateExpense });
        render(<Expenses />);
        fireEvent.click(screen.getByText('Cena CM'));
        fireEvent.change(screen.getByLabelText('A cargo de'), { target: { value: 'people' } });
        fireEvent.click(screen.getByText('Por Importe'));
        fireEvent.change(screen.getByLabelText('Importe para Jose'), { target: { value: '20' } });
        fireEvent.change(screen.getByLabelText('Importe para Maria'), { target: { value: '60' } });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
        await waitFor(() => expect(updateExpense).toHaveBeenCalledWith('e1', expect.objectContaining({ chargeTo: 'people', splitMode: 'custom', splitAmong: ['u1', 'u2'], customAmounts: { u1: '20', u2: '60' } })));
    });

    it('lets a recurring CM rule switch to custom personal allocation and rejects mismatched totals', async () => {
        const updateRecurringExpense = vi.fn();
        StoreContext.useStore.mockReturnValue({ expenses: [], recurringExpenses: [{ id: 'r1', title: 'Recibo', amount: 80, category: 'home', payerId: 'u1', chargeTo: 'common', splitAmong: ['u1', 'u2'], startMonth: '2026-09', active: true }], householdMembers: members, user: { uid: 'u1' }, household: { id: 'h1' }, updateRecurringExpense });
        render(<Expenses />);
        fireEvent.click(screen.getByRole('button', { name: 'Gastos recurrentes' }));
        fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
        fireEvent.change(screen.getByLabelText('A cargo de'), { target: { value: 'people' } });
        fireEvent.click(screen.getByText('Por Importe'));
        fireEvent.change(screen.getByLabelText('Importe para Jose'), { target: { value: '79.99' } });
        fireEvent.click(screen.getByRole('button', { name: 'Actualizar Regla' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('exactamente');
        expect(updateRecurringExpense).not.toHaveBeenCalled();
        fireEvent.change(screen.getByLabelText('Importe para Maria'), { target: { value: '0.01' } });
        fireEvent.click(screen.getByRole('button', { name: 'Actualizar Regla' }));
        await waitFor(() => expect(updateRecurringExpense).toHaveBeenCalledWith('r1', expect.objectContaining({ chargeTo: 'people', splitMode: 'custom', splitAmong: ['u1', 'u2'], customAmounts: { u1: '79.99', u2: '0.01' } })));
    });

    it('creates a recurring expense charged to the CM', async () => {
        const addRecurringExpense = vi.fn();
        const generateRecurringExpenses = vi.fn();
        StoreContext.useStore.mockReturnValue({ expenses: [], recurringExpenses: [], householdMembers: members, user: { uid: 'u1' }, household: { id: 'h1' }, addRecurringExpense, generateRecurringExpenses });
        render(<Expenses />);
        fireEvent.click(screen.getByRole('button', { name: 'Gastos recurrentes' }));
        fireEvent.click(screen.getByRole('button', { name: 'Nuevo' }));
        fireEvent.change(screen.getByLabelText('A cargo de'), { target: { value: 'common' } });
        fireEvent.change(screen.getByPlaceholderText('Ej. Alquiler'), { target: { value: 'Recibo compartido' } });
        fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '80' } });
        fireEvent.change(screen.getByDisplayValue('Selecciona una categoría'), { target: { value: 'home' } });
        expect(screen.queryByText('Para quién')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '🔄 Crear Recurrente' }));
        await waitFor(() => expect(addRecurringExpense).toHaveBeenCalledWith(expect.objectContaining({ title: 'Recibo compartido', amount: 80, chargeTo: 'common', payerId: 'u1', splitAmong: ['u1', 'u2', 'u3'], splitMode: 'equal', customAmounts: {} })));
        await waitFor(() => expect(generateRecurringExpenses).toHaveBeenCalled());
    });

    it.each(['people', 'common'])('edits a %s recurring rule and preserves the chosen destination', async chargeTo => {
        const updateRecurringExpense = vi.fn();
        const rule = { id: 'r1', title: 'Recibo', amount: 80, category: 'home', payerId: 'u1', splitAmong: ['u1', 'u2'], chargeTo, startMonth: '2026-09', active: true };
        StoreContext.useStore.mockReturnValue({ expenses: [], recurringExpenses: [rule], householdMembers: members, user: { uid: 'u1' }, household: { id: 'h1' }, updateRecurringExpense });
        render(<Expenses />);
        fireEvent.click(screen.getByRole('button', { name: 'Gastos recurrentes' }));
        fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
        expect(screen.getByLabelText('A cargo de')).toHaveValue(chargeTo);
        fireEvent.change(screen.getByLabelText('A cargo de'), { target: { value: 'common' } });
        fireEvent.click(screen.getByRole('button', { name: 'Actualizar Regla' }));
        await waitFor(() => expect(updateRecurringExpense).toHaveBeenCalledWith('r1', expect.objectContaining({ chargeTo: 'common', payerId: 'u1', amount: 80 })));
    });

    it('keeps monthly personal debts separate from CM debts', () => {
        const date = new Date().toISOString();
        StoreContext.useStore.mockReturnValue({ expenses: [
            { id: 'personal', title: 'Compra personal', amount: 60, payerId: 'u1', splitAmong: ['u2'], category: 'other', date },
            { id: 'cm', title: 'Cena CM', amount: 80, payerId: 'u2', splitAmong: ['u1', 'u2'], category: 'dining', chargeTo: 'common', date }
        ], recurringExpenses: [], householdMembers: members, user: { uid: 'u1' }, household: { id: 'h1' } });
        render(<Expenses />);
        fireEvent.click(screen.getByText(/Saldos/i));
        expect(screen.getByText('+60.00€')).toBeInTheDocument();
        expect(screen.getByText('-60.00€')).toBeInTheDocument();
        const common = within(screen.getByRole('region', { name: 'Reembolsos de la cuenta común' }));
        expect(common.getAllByText('Maria')).toHaveLength(2);
        expect(common.queryByText('Cena CM')).not.toBeInTheDocument();
        expect(common.getByText('+80.00€')).toBeInTheDocument();
        expect(screen.getAllByText('paga a')).toHaveLength(2);
    });

    it('creates a CM advance and restores the people option when opening another expense', async () => {
        const addExpense = vi.fn();
        StoreContext.useStore.mockReturnValue({ expenses: [], recurringExpenses: [], householdMembers: members, user: { uid: 'u1' }, household: { id: 'h1' }, addExpense });
        render(<Expenses />);
        fireEvent.click(screen.getByRole('button', { name: 'Añadir gasto' }));
        fireEvent.change(screen.getByPlaceholderText('Ej. Compra'), { target: { value: 'Cena restaurante' } });
        fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '80' } });
        fireEvent.change(screen.getByDisplayValue('Selecciona una categoría'), { target: { value: 'dining' } });
        fireEvent.change(screen.getByLabelText('A cargo de'), { target: { value: 'common' } });
        expect(screen.queryByText('Partes Iguales')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Guardar Gasto' }));
        await waitFor(() => expect(addExpense).toHaveBeenCalledWith('Cena restaurante', 80, 'dining', 'u1', ['u1', 'u2', 'u3'], 'equal', {}, expect.any(String), 'common'));
        await waitFor(() => expect(screen.queryByText('Nuevo Gasto')).not.toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: 'Añadir gasto' }));
        expect(screen.getByLabelText('A cargo de')).toHaveValue('people');
    });

    it('does not generate recurring expenses when browsing the next month', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2026, 8, 19));
        const generateRecurringExpenses = vi.fn();
        StoreContext.useStore.mockReturnValue({ expenses: [], recurringExpenses: [], householdMembers: members, user: { uid: 'u1' }, household: { id: 'h1' }, generateRecurringExpenses });
        render(<Expenses />);
        const monthButton = screen.getByRole('button', { name: 'septiembre 2026' });
        const navigation = monthButton.parentElement.parentElement;
        fireEvent.click(navigation.querySelectorAll('button')[2]);
        expect(screen.getByRole('button', { name: /octubre 2026/i })).toBeInTheDocument();
        expect(generateRecurringExpenses).not.toHaveBeenCalled();
    });

    it('includes bank imports in totals but never in manual list or balances, and removes their totals on deletion', () => {
        const date = new Date().toISOString().slice(0, 10);
        StoreContext.useStore.mockReturnValue({ expenses: [{ id: 'manual', title: 'Manual', amount: 50, payerId: 'u1', splitAmong: ['u1', 'u2'], category: 'groceries', date }], recurringExpenses: [], householdMembers: members, user: { uid: 'u1' }, household: { id: 'h1' } });
        const reports = [{ id: 'report', fileName: 'test.xlsx', entries: [{ title: 'Banco', amount: 400, category: 'groceries', date }] }];
        useBankImports.mockReturnValue({ reports, loading: false, error: '' });
        const view = render(<Expenses />);
        expect(screen.getByText('Total: 450€')).toBeInTheDocument();
        expect(screen.getByText('Listado (1)')).toBeInTheDocument();
        expect(screen.queryByText('Banco')).not.toBeInTheDocument();
        fireEvent.click(screen.getByText(/Saldos/i));
        expect(screen.getByText('+25.00€')).toBeInTheDocument();
        expect(screen.getByText('-25.00€')).toBeInTheDocument();
        expect(screen.queryByText('Ex-miembro')).not.toBeInTheDocument();
        useBankImports.mockReturnValue({ reports: [], loading: false, error: '' });
        view.rerender(<Expenses />);
        expect(screen.getByText('Total: 50€')).toBeInTheDocument();
        expect(screen.getByText('+25.00€')).toBeInTheDocument();
    });

    it('keeps a settled month settled when bank reports are added', () => {
        const date = new Date().toISOString().slice(0, 10);
        StoreContext.useStore.mockReturnValue({ expenses: [
            { id: 'manual', amount: 50, payerId: 'u1', splitAmong: ['u1', 'u2'], category: 'groceries', date },
            { id: 'settlement', amount: 25, payerId: 'u2', splitAmong: ['u1'], category: 'settlement', date }
        ], recurringExpenses: [], householdMembers: members, user: { uid: 'u1' }, household: { id: 'h1' } });
        useBankImports.mockReturnValue({ reports: [{ id: 'report', entries: [{ title: 'Banco', amount: 1000, category: 'other', date }] }], loading: false, error: '' });
        render(<Expenses />);
        fireEvent.click(screen.getByText(/Saldos/i));
        expect(screen.getByText(/Todo cuadrado/i)).toBeInTheDocument();
    });

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
