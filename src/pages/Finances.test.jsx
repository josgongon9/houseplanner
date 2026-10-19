import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import Finances from './Finances';
import { updateDoc } from '../lib/firebase';

const store = vi.hoisted(() => ({ user: { uid: 'u1' } }));
const snapshots = vi.hoisted(() => ({ defer: false, pending: [] }));
vi.mock('../context/StoreContext', () => ({ useStore: () => store }));
vi.mock('../lib/firebase', async importOriginal => ({
    ...await importOriginal(),
    doc: (...args) => args.slice(1).join('/'),
    collection: (...args) => args.slice(1).join('/'),
    where: (field, op, value) => ({ field, value }),
    query: (path, ...filters) => ({ path, filters }),
    updateDoc: vi.fn().mockResolvedValue(undefined),
    onSnapshot: (ref, callback) => {
        if (snapshots.defer) {
            snapshots.pending.push({ ref, callback });
            return () => {};
        }
        if (typeof ref === 'string') callback({ exists: () => true, data: () => ({
            incomeCategories: ['Acciones'], expenseCategories: [],
            monthly: { 0: { incomes: { Acciones: 70 } } },
        }) });
        else {
            const sale = ref.filters.some(filter => filter.value === 'sale');
            callback({ docs: (sale ? [
                { id: 's1', date: '2026-01-10', company: 'A', buyAmount: 100, sellAmount: 200, profit: 100, roi: 100 },
                { id: 's2', date: '2026-01-11', company: 'B', buyAmount: 100, sellAmount: 70, profit: -30, roi: -30 },
            ] : []).map(item => ({ id: item.id, data: () => item })) });
        }
        return () => {};
    },
}));

describe('Finances automatic stock amounts', () => {
    beforeEach(() => {
        snapshots.defer = false;
        snapshots.pending = [];
        vi.clearAllMocks();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2026, 9, 19, 12));
    });
    afterEach(() => vi.useRealTimers());
    it('renders separate automatic income and expense rows and three sales totals', () => {
        render(<Finances />);
        const rows = screen.getAllByText('Acciones').map(label => label.closest('tr'));
        expect(rows).toHaveLength(2);
        expect(within(rows[0]).getAllByRole('spinbutton')[0]).toHaveValue(100);
        expect(within(rows[1]).getAllByRole('spinbutton')[0]).toHaveValue(30);
        for (const row of rows) expect(within(row).getAllByRole('spinbutton')[0]).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Inversiones' }));
        expect(within(screen.getByText('Plusvalías Ventas').parentElement).getByText('100.00€')).toBeInTheDocument();
        expect(within(screen.getByText('Pérdidas Ventas').parentElement).getByText('-30.00€')).toBeInTheDocument();
        expect(within(screen.getByText('Total Ventas').parentElement).getByText('70.00€')).toBeInTheDocument();
    });

    it('waits for the new year budget and investments before allowing edits', () => {
        const { container } = render(<Finances />);
        snapshots.defer = true;
        fireEvent.click(screen.getByTitle('Configuración y Año'));
        fireEvent.click(container.querySelector('.lucide-chevron-right').closest('button'));
        expect(screen.getByRole('status')).toHaveTextContent('Cargando datos');
        expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);

        const budget = snapshots.pending.find(({ ref }) => typeof ref === 'string');
        act(() => budget.callback({ exists: () => true, data: () => ({ incomeCategories: [], expenseCategories: [], monthly: {} }) }));
        expect(screen.getByRole('status')).toBeInTheDocument();
        const stocks = snapshots.pending.find(({ ref }) => ref.filters?.some(f => f.field === 'year') && ref.filters.some(f => f.value === 'sale'));
        act(() => stocks.callback({ docs: [] }));
        expect(screen.getByRole('status')).toBeInTheDocument();
        const dividends = snapshots.pending.find(({ ref }) => ref.filters?.some(f => f.field === 'year') && ref.filters.some(f => f.value === 'dividend'));
        act(() => dividends.callback({ docs: [] }));
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        const rows = screen.getAllByText('Acciones').map(label => label.closest('tr'));
        for (const row of rows) expect(within(row).getAllByRole('spinbutton')[0]).toHaveValue(null);
    });

    it('moves an edited sale to its date year and saves its profit in whole cents', async () => {
        const { container } = render(<Finances />);
        fireEvent.click(screen.getByRole('button', { name: 'Inversiones' }));
        fireEvent.click(screen.getByRole('button', { name: 'Editar venta A' }));
        fireEvent.change(container.querySelector('input[type="date"]'), { target: { value: '2025-12-31' } });
        const amounts = screen.getAllByRole('spinbutton');
        fireEvent.change(amounts[0], { target: { value: '0.30' } });
        fireEvent.change(amounts[1], { target: { value: '0.10' } });
        fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
        await waitFor(() => expect(updateDoc).toHaveBeenCalledWith('users/u1/investments/s1', expect.objectContaining({
            date: '2025-12-31', year: 2025, profit: -0.2,
        })));
    });
});
