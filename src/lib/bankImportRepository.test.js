import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveBankImport, removeBankImport } from './bankImportRepository';
import { runTransaction, deleteDoc } from './firebase';
vi.mock('./firebase', () => ({ db: {}, doc: (_, ...parts) => parts.join('/'), runTransaction: vi.fn(), deleteDoc: vi.fn() }));
const report = { fileName: 'test.xlsx', entries: [{ title: 'Compra', date: '2026-09-19', amount: 25, category: 'other' }] };

describe('Atomic bank reports, isolated from manual expenses', () => {
    beforeEach(() => vi.resetAllMocks());
    it('writes one report in the household bank collection, never the expense collection', async () => {
        const set = vi.fn();
        runTransaction.mockImplementation(async (_, action) => action({ get: async () => ({ exists: () => false }), set }));
        const id = await saveBankImport('home1', 'user1', report);
        expect(set).toHaveBeenCalledOnce();
        expect(set.mock.calls[0][0]).toBe(`households/home1/bankExpenseImports/${id}`);
        expect(set.mock.calls[0][1].entries).toEqual(report.entries);
    });
    it('rejects duplicate imports transactionally', async () => {
        const set = vi.fn();
        runTransaction.mockImplementation(async (_, action) => action({ get: async () => ({ exists: () => true }), set }));
        await expect(saveBankImport('home1', 'user1', report)).rejects.toThrow('ya está importado');
        expect(set).not.toHaveBeenCalled();
    });
    it('deletes the complete report with one operation in its own household', async () => {
        await removeBankImport('home1', 'report1');
        expect(deleteDoc).toHaveBeenCalledExactlyOnceWith('households/home1/bankExpenseImports/report1');
    });
    it('does not report success when writes fail and rejects oversized imports before writing', async () => {
        runTransaction.mockRejectedValue(new Error('offline'));
        await expect(saveBankImport('home1', 'user1', report)).rejects.toThrow('offline');
        runTransaction.mockClear();
        await expect(saveBankImport('home1', 'user1', { ...report, entries: Array(3001).fill(report.entries[0]) })).rejects.toThrow('demasiado grande');
        expect(runTransaction).not.toHaveBeenCalled();
    });
});
