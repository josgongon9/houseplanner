import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import Planner from '../pages/Planner';
import * as StoreContext from '../context/StoreContext';

// Mock the context hook
vi.mock('../context/StoreContext', () => ({
    useStore: vi.fn(),
}));

describe('Planner Component', () => {
    const mockMeals = [
        { id: 'meal1', name: 'Lentejas', type: 'lunch', quantity: 10 },
        { id: 'meal2', name: 'Pollo', type: 'lunch', quantity: 10 },
        { id: 'meal3', name: 'Sopa', type: 'dinner', quantity: 10 },
    ];

    const mockMenu = {}; // Empty menu for starting tests

    // Mock current date to be a fixed value: Monday Jan 12, 2026
    const mockToday = new Date('2026-01-12T12:00:00Z');

    beforeAll(() => {
        vi.useFakeTimers();
        vi.setSystemTime(mockToday);
    });

    afterAll(() => {
        vi.useRealTimers();
    });

    it('renders the planner with days of the week', () => {
        StoreContext.useStore.mockReturnValue({
            meals: mockMeals,
            menu: mockMenu,
            household: { name: 'Mi Hogar' },
            setMenuItem: vi.fn(),
            isLoading: false
        });

        render(<Planner />);

        expect(screen.getByText(/lun/i)).toBeInTheDocument();
        expect(screen.getByText(/dom/i)).toBeInTheDocument();
        expect(screen.getByText('Mi Hogar')).toBeInTheDocument();
    });

    it('opens modal and auto-sets portion to 1.0 for first meal', async () => {
        const mockSetMenuItem = vi.fn();
        StoreContext.useStore.mockReturnValue({
            meals: mockMeals,
            menu: mockMenu,
            setMenuItem: mockSetMenuItem,
            isLoading: false
        });

        render(<Planner />);

        // Today is 2026-01-12
        const lunchSlot = screen.getByLabelText(/Slot lunch 2026-01-12/i);
        fireEvent.click(lunchSlot);

        // In the modal, find "Lentejas"
        const lentejasBtn = screen.getByText('Lentejas');
        fireEvent.click(lentejasBtn);

        // "COMIDAS SELECCIONADAS" should have 1.0
        expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    });

    it('auto-sets portions to 0.5 when two meals are added', () => {
        StoreContext.useStore.mockReturnValue({
            meals: mockMeals,
            menu: mockMenu,
            setMenuItem: vi.fn(),
            isLoading: false
        });

        render(<Planner />);
        fireEvent.click(screen.getByLabelText(/Slot lunch 2026-01-12/i));

        fireEvent.click(screen.getByText('Lentejas'));
        fireEvent.click(screen.getByText('Pollo'));

        const inputs = screen.getAllByDisplayValue('0.5');
        expect(inputs.length).toBe(2);
    });

    it('reverts back to 1.0 when one of two meals is removed', () => {
        StoreContext.useStore.mockReturnValue({
            meals: mockMeals,
            menu: mockMenu,
            setMenuItem: vi.fn(),
            isLoading: false
        });

        render(<Planner />);
        fireEvent.click(screen.getByLabelText(/Slot lunch 2026-01-12/i));

        fireEvent.click(screen.getByText('Lentejas'));
        fireEvent.click(screen.getByText('Pollo'));

        const minusButtons = screen.getAllByText('-');
        // Click minus once (removes the meal because it was 0.5)
        // Wait, handleUpdatePortion removes if newPortion <= 0.
        // 0.5 - 0.5 = 0.
        fireEvent.click(minusButtons[0]);

        // The remaining one should become 1.0
        expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    });

    it('filters available meals in the modal based on search', () => {
        StoreContext.useStore.mockReturnValue({
            meals: mockMeals,
            menu: mockMenu,
            setMenuItem: vi.fn(),
            isLoading: false
        });

        render(<Planner />);
        fireEvent.click(screen.getByLabelText(/Slot lunch 2026-01-12/i));

        const searchInput = screen.getByPlaceholderText('Buscar comida...');
        fireEvent.change(searchInput, { target: { value: 'lent' } });

        expect(screen.getByText('Lentejas')).toBeInTheDocument();
        expect(screen.queryByText('Pollo')).not.toBeInTheDocument();
    });
});
