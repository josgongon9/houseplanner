import { describe, expect, it } from 'vitest';
import { stockTotals, withStockBudget } from './investmentBudget';

describe('Investment gains and losses', () => {
    it('separates gains and losses without floating point drift', () => {
        expect(stockTotals([{ profit: 0.1 }, { profit: 0.2 }, { profit: -0.15 }, { profit: 0 }]))
            .toEqual({ gains: 0.3, losses: 0.15, total: 0.15 });
        expect(stockTotals([])).toEqual({ gains: 0, losses: 0, total: 0 });
        expect(stockTotals([{ profit: -30 }])).toEqual({ gains: 0, losses: 30, total: -30 });
    });

    it('replaces legacy net income while preserving manual entries and dividends', () => {
        const saved = { incomeCategories: ['Salario', 'Acciones'], expenseCategories: ['Comida'], monthly: {
            0: { incomes: { Salario: 1000, Acciones: 70, Dividendos: 5 }, expenses: { Comida: 80 } },
        } };
        const budget = withStockBudget(saved, [{ date: '2026-01-10', profit: 100 }, { date: '2026-01-15', profit: -30 }]);
        expect(budget.monthly[0]).toEqual({ incomes: { Salario: 1000, Acciones: 100, Dividendos: 5 }, expenses: { Comida: 80, Acciones: 30 } });
        expect(budget.incomeCategories).toEqual(['Salario', 'Acciones']);
        expect(budget.expenseCategories).toEqual(['Comida', 'Acciones']);
        expect(saved.monthly[0].incomes.Acciones).toBe(70);
    });

    it('recalculates a sale moved to another month, changed to a loss, then deleted', () => {
        const original = withStockBudget({}, [{ date: '2026-01-10', profit: 100 }]);
        const edited = withStockBudget(original, [{ date: '2026-02-10', profit: -20 }]);
        expect(edited.monthly[0].incomes.Acciones).toBe(0);
        expect(edited.monthly[1].expenses.Acciones).toBe(20);
        const deleted = withStockBudget(edited, []);
        expect(deleted.monthly[1].expenses.Acciones).toBe(0);
    });
});
