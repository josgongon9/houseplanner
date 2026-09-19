import React from 'react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MoneyOrganization, { calculateDistribution } from './MoneyOrganization';
import { getDoc, setDoc } from '../lib/firebase';

vi.mock('../lib/firebase', () => ({ db: {}, doc: (...parts) => parts.slice(1).join('/'), getDoc: vi.fn(), setDoc: vi.fn() }));
const savedPlan = { income: 2000, destinations: [
    { id: 'invest', name: 'Inversión', mode: 'percent', amount: 20, done: true },
    { id: 'joint', name: 'Cuenta común', mode: 'fixed', amount: 800, done: false },
] };
const snapshot = plan => ({ exists: () => !!plan, data: () => ({ plan }) });
const mount = () => render(<MoneyOrganization userId="test-user" onDirtyChange={vi.fn()} />);

describe('Monthly money organization', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2027, 0, 15, 12));
        getDoc.mockReset().mockResolvedValue(snapshot(null));
        setDoc.mockReset().mockResolvedValue(undefined);
    });
    afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

    it('calculates fixed and percentage destinations in cents, including overspending', () => {
        expect(calculateDistribution(savedPlan)).toMatchObject({ income: 200000, allocated: 120000, remaining: 80000 });
        expect(calculateDistribution({ income: 0.3, destinations: [
            { amount: 0.1, mode: 'fixed' }, { amount: 0.2, mode: 'fixed' },
        ] }).remaining).toBe(0);
        expect(calculateDistribution({ ...savedPlan, income: 500 }).remaining).toBe(-40000);
    });

    it('saves a personal plan in the selected month and reloads it', async () => {
        const view = mount();
        fireEvent.change(await screen.findByLabelText('Nómina neta del mes'), { target: { value: '2000' } });
        fireEvent.change(screen.getByLabelText('Importe del destino 1'), { target: { value: '400' } });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar reparto' }));
        await waitFor(() => expect(setDoc).toHaveBeenCalledOnce());
        expect(setDoc.mock.calls[0][0]).toBe('users/test-user/finance_years/organization-2027-01');
        const persisted = setDoc.mock.calls[0][1].plan;
        expect(persisted.income).toBe(2000);
        expect(persisted.destinations[0].amount).toBe(400);
        await screen.findByText('Plan guardado');
        view.unmount();
        getDoc.mockResolvedValue(snapshot(persisted));
        mount();
        expect(await screen.findByLabelText('Nómina neta del mes')).toHaveValue(2000);
        expect(screen.getByLabelText('Importe del destino 1')).toHaveValue(400);
    });

    it('copies December into January without changing history and discards legacy transfer states', async () => {
        getDoc.mockImplementation(async ref => snapshot(ref.endsWith('2026-12') ? savedPlan : null));
        mount();
        fireEvent.click(await screen.findByRole('button', { name: 'Copiar mes anterior' }));
        await waitFor(() => expect(screen.getByLabelText('Nómina neta del mes')).toHaveValue(2000));
        expect(screen.queryByRole('button', { name: /Transferencia/ })).not.toBeInTheDocument();
        expect(savedPlan.destinations[0].done).toBe(true);
        expect(setDoc).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Guardar reparto' }));
        await screen.findByText('Plan guardado');
        expect(setDoc.mock.calls[0][1].plan.destinations.every(item => !('done' in item))).toBe(true);
        fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
        await waitFor(() => expect(screen.getByLabelText('Nómina neta del mes')).toHaveValue(2000));
        expect(screen.getByText('diciembre de 2026')).toBeInTheDocument();
    });

    it('keeps edits after a failed save and supports retry', async () => {
        setDoc.mockRejectedValueOnce(new Error('offline'));
        mount();
        fireEvent.change(await screen.findByLabelText('Nómina neta del mes'), { target: { value: '1800' } });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar reparto' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar');
        expect(screen.getByLabelText('Nómina neta del mes')).toHaveValue(1800);
        fireEvent.click(screen.getByRole('button', { name: 'Guardar reparto' }));
        await screen.findByText('Plan guardado');
    });

    it('prevents editing after a failed load and guards unsaved month navigation', async () => {
        getDoc.mockRejectedValueOnce(new Error('offline'));
        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
        mount();
        expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar');
        expect(screen.queryByLabelText('Nómina neta del mes')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
        fireEvent.change(await screen.findByLabelText('Nómina neta del mes'), { target: { value: '2000' } });
        fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
        expect(confirm).toHaveBeenCalledOnce();
        expect(screen.getByText('enero de 2027')).toBeInTheDocument();
        expect(screen.getByLabelText('Nómina neta del mes')).toHaveValue(2000);
    });
});
