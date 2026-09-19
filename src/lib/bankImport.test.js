import { describe, expect, it } from 'vitest';
import { bankCategory, bankAmount, bankDate, parseBankRows, bankReportId, countOverlappingEntries } from './bankImport';

const categories = [{ id: 'groceries', name: 'Supermercados' }, { id: 'dining', name: 'Restaurantes' }, { id: 'leisure', name: 'OCIO' }, { id: 'home', name: 'Hogar' }, { id: 'other', name: 'Otro' }, { id: 'settlement', name: 'Liquidación' }];
const header = [null, 'Fecha', 'Producto', 'Entidad', 'Categoría', 'Subcategoría', 'Importe', 'Concepto', 'Observaciones'];
const row = (amount, category = 'Compras', subcategory = 'Alimentación') => [null, '19/09/2026', 'Cuenta', 'BBVA', category, subcategory, amount, 'Compra de prueba', ''];

describe('BBVA detailed movement import', () => {
    it('ignores summaries and all income while preserving every negative movement', () => {
        const result = parseBankRows([[null, 'Desde', 'Hasta', 'Categoría', 'Subcategoría', 'Importe'], [null, '01/09/2026', '30/09/2026', 'Total', '', '-999,00'], header,
            row('-1.234,56'), row('200,00'), row('-400,00', 'No categorizable', 'Autotransferencia emitida'), row('0,00'), row('-8,00'), row('-8,00')], categories);
        expect(result.excluded).toBe(2);
        expect(result.entries.map(e => e.amount)).toEqual([1234.56, 400, 8, 8]);
        expect(result.entries[0]).toMatchObject({ title: 'Compra de prueba', date: '2026-09-19', category: 'groceries' });
        expect(result.entries.every(e => !('payerId' in e) && !('splitAmong' in e))).toBe(true);
    });
    it('maps explicit subcategory exceptions before the parent and otherwise matches existing categories', () => {
        expect(bankCategory('Ocio', 'Bares y restaurantes', categories)).toBe('dining');
        expect(bankCategory('OCIO', 'Espectáculos', categories)).toBe('leisure');
        expect(bankCategory('Compras', 'Alimentación', categories)).toBe('groceries');
        expect(bankCategory('No existe', 'Hogar', categories)).toBe('home');
        expect(bankCategory('Desconocida', 'Desconocida', categories)).toBe('other');
        expect(bankCategory('Liquidación', '', categories)).toBe('other');
        expect(bankCategory('Ocio', 'Bares y restaurantes', [{ id: 'custom', name: 'Restaurantes' }])).toBe('custom');
    });
    it('accepts typed Excel amounts and dates, rejects invalid dates and ambiguous amounts', () => {
        expect(bankAmount(-23.42)).toBe(-23.42);
        expect(bankAmount('-1.234,56 €')).toBe(-1234.56);
        expect(bankDate(new Date('2026-09-19T00:00:00Z'))).toBe('2026-09-19');
        expect(() => bankDate('31/02/2026')).toThrow();
        expect(() => bankAmount('')).toThrow();
        expect(() => bankAmount('-12.34')).toThrow();
    });
    it('rejects malformed rows instead of silently importing a partial report', () => {
        const invalid = row('-9,50'); invalid[1] = '31/09/2026';
        expect(() => parseBankRows([header, row('-10,00'), invalid], categories)).toThrow('Fila 3');
        expect(() => parseBankRows([row('-10,00')], categories)).toThrow('tabla');
        expect(() => parseBankRows([header, row('20,00')], categories)).toThrow('salidas');
    });
    it('recognizes renamed or reordered reports without collapsing repeated real charges', async () => {
        const { entries } = parseBankRows([header, row('-8,00'), row('-8,00'), row('-5,00')], categories);
        expect(await bankReportId(entries)).toBe(await bankReportId([...entries].reverse().map(e => ({ ...e, category: 'other' }))));
        expect(await bankReportId(entries)).not.toBe(await bankReportId(entries.slice(1)));
        expect(countOverlappingEntries(entries, [{ entries: entries.slice(1) }])).toBe(2);
    });
});
