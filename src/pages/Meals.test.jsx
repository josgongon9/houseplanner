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
        { id: 'meal1', name: 'Lentejas', type: 'lunch', quantity: 2.0, notes: 'Ricas', ingredients: 'Lentejas, chorizo' },
        { id: 'meal2', name: 'Sopa', type: 'dinner', quantity: 1.0 },
    ];

    it('renders the meals list sorted alphabetically', () => {
        StoreContext.useStore.mockReturnValue({
            meals: mockMeals,
            addMeal: vi.fn(),
            updateMealStock: vi.fn(),
            updateMeal: vi.fn(),
            deleteMeal: vi.fn()
        });

        render(<Meals />);

        expect(screen.getByText('Comidas')).toBeInTheDocument();

        // Check if both meals are rendered
        expect(screen.getByText('Lentejas')).toBeInTheDocument();
        expect(screen.getByText('Sopa')).toBeInTheDocument();

        // Check if types are rendered correctly
        expect(screen.getByText('Almuerzo')).toBeInTheDocument();
        expect(screen.getByText('Cena')).toBeInTheDocument();
    });

    it('filters meals by search query', () => {
        StoreContext.useStore.mockReturnValue({
            meals: mockMeals,
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

    it('opens recipe modal when clicking on a meal', () => {
        StoreContext.useStore.mockReturnValue({
            meals: mockMeals,
            addMeal: vi.fn(),
            updateMealStock: vi.fn(),
            updateMeal: vi.fn(),
            deleteMeal: vi.fn()
        });

        render(<Meals />);

        const mealItem = screen.getByText('Lentejas');
        fireEvent.click(mealItem);

        // Check if modal title appears
        expect(screen.getByText('Recetario y Notas')).toBeInTheDocument();
        // Check if ingredients are prepopulated
        expect(screen.getByDisplayValue('Lentejas, chorizo')).toBeInTheDocument();
    });

    it('calls updateMeal when saving a recipe', async () => {
        const mockUpdateMeal = vi.fn();
        StoreContext.useStore.mockReturnValue({
            meals: mockMeals,
            addMeal: vi.fn(),
            updateMealStock: vi.fn(),
            updateMeal: mockUpdateMeal,
            deleteMeal: vi.fn()
        });

        render(<Meals />);

        fireEvent.click(screen.getByText('Lentejas'));

        const ingredientsArea = screen.getByPlaceholderText(/Ej: 200g Lentejas/i);
        fireEvent.change(ingredientsArea, { target: { value: 'Nuevos ingredientes' } });

        const saveButton = screen.getByText(/Guardar Receta/i);
        fireEvent.click(saveButton);

        expect(mockUpdateMeal).toHaveBeenCalledWith('meal1', expect.objectContaining({
            ingredients: 'Nuevos ingredientes'
        }));
    });

    it('shows double confirmation before deleting', () => {
        const mockDeleteMeal = vi.fn();
        const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

        StoreContext.useStore.mockReturnValue({
            meals: mockMeals,
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
