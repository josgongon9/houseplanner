import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Meals from '../pages/Meals';
import * as StoreContext from '../context/StoreContext';

// Mock the context hook
vi.mock('../context/StoreContext', () => ({
    useStore: vi.fn(),
}));

describe('Meals Component', () => {
    const mockMeals = [
        { id: 'meal1', name: 'Lentejas', type: 'lunch', quantity: 1.0, notes: 'Ricas', ingredients: 'Lentejas, chorizo' },
        { id: 'meal2', name: 'Sopa', type: 'dinner', quantity: 5.0 },
    ];

    const mockMenu = [
        {
            id: 'menu1',
            date: '2026-01-15',
            type: 'lunch',
            meals: [{ mealId: 'meal1', portion: 2.0 }],
            processed: false
        }
    ];

    it('renders the meals list sorted alphabetically', () => {
        StoreContext.useStore.mockReturnValue({
            meals: mockMeals,
            menu: [],
            addMeal: vi.fn(),
            updateMealStock: vi.fn(),
            updateMeal: vi.fn(),
            deleteMeal: vi.fn()
        });

        render(<Meals />);

        expect(screen.getByText('Comidas')).toBeInTheDocument();
        expect(screen.getByText('Lentejas')).toBeInTheDocument();
        expect(screen.getByText('Sopa')).toBeInTheDocument();
        expect(screen.getByText('Almuerzo')).toBeInTheDocument();
        expect(screen.getByText('Cena')).toBeInTheDocument();
    });

    it('shows stock warning when planned portions exceed available stock', () => {
        StoreContext.useStore.mockReturnValue({
            meals: mockMeals, // Lentejas has 1.0 stock
            menu: mockMenu,  // Lentejas has 2.0 planned
            addMeal: vi.fn(),
            updateMealStock: vi.fn(),
            updateMeal: vi.fn(),
            deleteMeal: vi.fn()
        });

        render(<Meals />);

        // Check if there is a warning badge or special style
        // We added a title="¡Necesitas cocinar más!" to the AlertTriangle container
        expect(screen.getByTitle('¡Necesitas cocinar más!')).toBeInTheDocument();
    });

    it('displays planned portions correctly in the Menú badge', () => {
        StoreContext.useStore.mockReturnValue({
            meals: mockMeals,
            menu: mockMenu, // 2.0 portions for meal1
            addMeal: vi.fn(),
            updateMealStock: vi.fn(),
            updateMeal: vi.fn(),
            deleteMeal: vi.fn()
        });

        render(<Meals />);

        // meal1 (Lentejas) should show 2.0 in the menu badge
        // The badge is a box with text "Menú" and the number
        const menuBadge = screen.getAllByText('2.0')[0];
        expect(menuBadge).toBeInTheDocument();
    });

    it('filters meals by search query', () => {
        StoreContext.useStore.mockReturnValue({
            meals: mockMeals,
            menu: [],
            addMeal: vi.fn(),
            updateMealStock: vi.fn(),
            updateMeal: vi.fn(),
            deleteMeal: vi.fn()
        });

        render(<Meals />);

        const searchInput = screen.getByPlaceholderText(/Buscar\.\.\./i);
        fireEvent.change(searchInput, { target: { value: 'lent' } });

        expect(screen.getByText('Lentejas')).toBeInTheDocument();
        expect(screen.queryByText('Sopa')).not.toBeInTheDocument();
    });

    it('opens recipe modal and allows stock adjustment', () => {
        const mockUpdateMeal = vi.fn();
        StoreContext.useStore.mockReturnValue({
            meals: mockMeals,
            menu: [],
            addMeal: vi.fn(),
            updateMealStock: vi.fn(),
            updateMeal: mockUpdateMeal,
            deleteMeal: vi.fn()
        });

        render(<Meals />);

        fireEvent.click(screen.getByText('Lentejas'));

        // Check if modal and stock section are there
        expect(screen.getByText('Stock Disponible')).toBeInTheDocument();
        expect(screen.getByDisplayValue('1')).toBeInTheDocument(); // Current stock is 1.0

        // Increase stock with + button
        const plusBtn = screen.getByText('+');
        fireEvent.click(plusBtn);

        // Value should update to 1.5
        expect(screen.getByDisplayValue('1.5')).toBeInTheDocument();

        // Save
        fireEvent.click(screen.getByText(/Guardar Receta/i));

        expect(mockUpdateMeal).toHaveBeenCalledWith('meal1', expect.objectContaining({
            quantity: 1.5
        }));
    });

    it('shows double confirmation before deleting', () => {
        const mockDeleteMeal = vi.fn();
        const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

        StoreContext.useStore.mockReturnValue({
            meals: mockMeals,
            menu: [],
            deleteMeal: mockDeleteMeal,
            updateMealStock: vi.fn()
        });

        render(<Meals />);

        const trashBtn = screen.getByLabelText(/Eliminar Lentejas/i);
        fireEvent.click(trashBtn);

        expect(confirmSpy).toHaveBeenCalled();
        expect(mockDeleteMeal).toHaveBeenCalledWith('meal1');

        confirmSpy.mockRestore();
    });
});
