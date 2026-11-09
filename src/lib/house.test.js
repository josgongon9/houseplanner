import { describe, it, expect } from 'vitest';
import { cents, houseName, hasItem, inventoryTotals, monthlyPayments, houseProjection } from './house';

describe('Casa: inventario y planificación', () => {
    it('normaliza mayúsculas, espacios y acentos para los duplicados', () => {
        expect(houseName('  TV ')).toBe(houseName('tv'));
        expect(houseName(' Sillón   azul ')).toBe(houseName('sillon azul'));
    });
    it('conserva la diferencia entre vacío y cero y opera en céntimos', () => {
        expect(cents('')).toBeNull(); expect(cents('0')).toBe(0);
        expect(cents('10,20')).toBe(1020);
        expect(() => cents('-1')).toThrow(); expect(() => cents('NaN')).toThrow();
        expect(cents('-10', true)).toBe(-1000);
    });
    it('compara TV de 500 estimados y 700 reales sin contar regalos como compras pendientes', () => {
        const result = inventoryTotals([
            { status: 'purchased', estimated: 50000, actual: 70000 },
            { status: 'pending', estimated: 30000 },
            { status: 'gift', estimated: 20000, actual: null },
            { status: 'owned', estimated: null, actual: null },
            { status: 'pending', estimated: null },
        ]);
        expect(result).toEqual({ estimated: 100000, actual: 70000, pending: 30000, difference: 20000, missingPrices: 1 });
        expect(hasItem({ status: 'gift', received: false })).toBe(false);
        expect(hasItem({ status: 'gift', received: true })).toBe(true);
        expect(hasItem({ status: 'owned' })).toBe(true);
    });
    it('genera mensualidades inclusivas ajustando el día en febrero bisiesto', () => {
        expect(monthlyPayments('2028-01', '2028-03', 10000, 31).map(p => p.due)).toEqual(['2028-01-31', '2028-02-29', '2028-03-31']);
        expect(() => monthlyPayments('2028-03', '2028-01', 10000)).toThrow();
    });
    it('descuenta pagos una sola vez y contempla vencidos en la necesidad de ahorro', () => {
        const result = houseProjection({
            savings: [{ date: '2026-01-01', amount: 1000000 }, { date: '2026-02-01', amount: -100000 }, { date: '2028-01-01', amount: 500000 }],
            payments: [
                { due: '2026-01-01', paidOn: '2026-01-01', amount: 200000 },
                { due: '2026-02-01', paidOn: '', amount: 100000 },
                { due: '2028-03-01', paidOn: '', amount: 300000 },
                { due: '2028-04-01', paidOn: '', amount: 500000 },
            ],
        }, '2028-03-31', '2026-10-23');
        expect(result).toEqual({ paid: 200000, balance: 700000, due: 400000, remaining: 900000, total: 1100000, overdue: 100000, projected: 300000 });
    });
});
