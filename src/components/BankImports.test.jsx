import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BankImports from './BankImports';
import { readSheet } from 'read-excel-file/browser';
import { saveBankImport, removeBankImport } from '../lib/bankImportRepository';
vi.mock('read-excel-file/browser', () => ({ readSheet: vi.fn() }));
vi.mock('../lib/bankImportRepository', () => ({ saveBankImport: vi.fn(), removeBankImport: vi.fn() }));
const categories = [{ id: 'other', name: 'Otro' }, { id: 'dining', name: 'Restaurantes' }];
const entry = { title: 'Café', amount: 8, category: 'dining', date: '2026-09-19' };
const props = { householdId: 'h1', userId: 'u1', reports: [], loading: false, loadError: '', categories, month: '2026-09' };
const upload = () => fireEvent.change(screen.getByLabelText('Importar informe BBVA'), { target: { files: [new File(['test'], 'test.xlsx')] } });

describe('Bank report review and removal', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        readSheet.mockResolvedValue([['Fecha', 'Categoría', 'Subcategoría', 'Importe', 'Concepto'], ['19/09/2026', 'Ocio', 'Bares y restaurantes', '-8,00', 'Café'], ['19/09/2026', 'Ingresos', '', '100,00', 'Ingreso']]);
        saveBankImport.mockResolvedValue('id');
        removeBankImport.mockResolvedValue(undefined);
    });
    it('requires review before saving and retains the preview when saving fails', async () => {
        saveBankImport.mockRejectedValueOnce(new Error('Sin conexión'));
        render(<BankImports {...props} />); upload();
        const save = await screen.findByRole('button', { name: 'Importar 1 gastos' });
        expect(saveBankImport).not.toHaveBeenCalled();
        expect(screen.getByText(/1 ingresos o importes cero excluidos/)).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Categoría del movimiento 1'), { target: { value: 'other' } });
        fireEvent.click(save);
        expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
        expect(screen.getByText('Café')).toBeInTheDocument();
        fireEvent.click(save);
        await screen.findByText('1 gastos importados');
        expect(saveBankImport.mock.calls[1][2].entries[0]).toMatchObject({ category: 'other', amount: 8 });
    });
    it('requires explicit acceptance of overlapping charges', async () => {
        render(<BankImports {...props} reports={[{ id: 'different', fileName: 'previous.xlsx', entries: [entry] }]} />); upload();
        const save = await screen.findByRole('button', { name: 'Importar 1 gastos' });
        expect(save).toBeDisabled();
        fireEvent.click(screen.getByRole('checkbox'));
        expect(save).toBeEnabled();
    });
    it('deletes a whole report only after confirmation and surfaces a failed deletion', async () => {
        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
        removeBankImport.mockRejectedValueOnce(new Error('offline'));
        render(<BankImports {...props} reports={[{ id: 'report1', fileName: 'previous.xlsx', entries: [entry] }]} />);
        fireEvent.click(screen.getByRole('button', { name: 'Eliminar informe previous.xlsx' }));
        expect(removeBankImport).not.toHaveBeenCalled();
        confirm.mockReturnValue(true);
        fireEvent.click(screen.getByRole('button', { name: 'Eliminar informe previous.xlsx' }));
        await waitFor(() => expect(removeBankImport).toHaveBeenCalledWith('h1', 'report1'));
        expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo eliminar');
        confirm.mockRestore();
    });
});
