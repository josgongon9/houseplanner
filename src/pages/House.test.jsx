import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { HousePanel } from './House';
const fixture = vi.hoisted(() => ({ data: {}, change: vi.fn(), manageCategory: vi.fn() }));
vi.mock('../hooks/useHouse', () => ({ default: () => ({ data: fixture.data, change: fixture.change, manageCategory: fixture.manageCategory, loading: false }) }));
vi.mock('../context/StoreContext', () => ({ useStore: () => ({}) }));

describe('Interfaz Casa', () => {
    it('ordena por importes numéricos en ambos sentidos y distingue los regalos recibidos', () => {
        fixture.data = { items: [
            { id: 'a', name: 'Mesa', category: 'Muebles', status: 'gift', received: false, estimated: 10000 },
            { id: 'b', name: 'Silla', category: 'Muebles', status: 'gift', received: true, estimated: 2000 },
        ] };
        render(<HousePanel householdId="home" />);
        fireEvent.click(screen.getByLabelText('Ordenar por Estimado'));
        expect(screen.getAllByRole('article').map(el => within(el).getByRole('heading').textContent)).toEqual(['Silla', 'Mesa']);
        fireEvent.click(screen.getByLabelText('Ordenar por Estimado'));
        expect(screen.getAllByRole('article').map(el => within(el).getByRole('heading').textContent)).toEqual(['Mesa', 'Silla']);
        fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'received' } });
        expect(screen.queryByText('Mesa')).not.toBeInTheDocument();
        expect(screen.getByText('Silla')).toBeInTheDocument();
        expect(screen.getByLabelText('Estado')).toHaveClass('house-have');
    });
    it('exige precio real al comprar y deja de exigirlo al cambiar a pendiente', () => {
        render(<HousePanel householdId="home" />);
        fireEvent.click(screen.getByText('Añadir objeto'));
        const status = within(screen.getByRole('dialog')).getByLabelText('Estado');
        fireEvent.change(status, { target: { value: 'purchased' } });
        expect(screen.getByLabelText('Real (€)')).toBeRequired();
        expect(screen.getByLabelText('Real (€)')).toBeInvalid();
        fireEvent.change(status, { target: { value: 'pending' } });
        expect(screen.getByLabelText('Real (€)')).not.toBeRequired();
    });
    beforeEach(() => { fixture.data = {}; fixture.change.mockReset(); fixture.change.mockResolvedValue(); fixture.manageCategory.mockReset(); fixture.manageCategory.mockResolvedValue(); });
    it('crea categorías desde su gestor sin tener que añadir objetos', async () => {
        render(<HousePanel householdId="home" />);
        fireEvent.click(screen.getByText('Gestionar categorías'));
        fireEvent.change(screen.getByLabelText('Nombre de la categoría'), { target: { value: 'Terraza' } });
        fireEvent.click(screen.getByRole('button', { name: 'Crear', exact: true }));
        await waitFor(() => expect(fixture.manageCategory).toHaveBeenCalledWith('Terraza', false));
    });
    it('confirma la eliminación y mantiene Otros protegido', async () => {
        fixture.data = { categories: ['Otros', 'Terraza'] };
        render(<HousePanel householdId="home" />);
        fireEvent.click(screen.getByText('Gestionar categorías'));
        expect(screen.queryByLabelText('Eliminar categoría Otros')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Eliminar categoría Salón')).not.toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Eliminar categoría Terraza'));
        expect(fixture.manageCategory).not.toHaveBeenCalled();
        expect(screen.getByText(/Sus objetos pasarán/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Eliminar categoría', exact: true }));
        await waitFor(() => expect(fixture.manageCategory).toHaveBeenCalledWith('Terraza', true));
    });
    it('añade un objeto con estimación sin inventar un gasto real', async () => {
        render(<HousePanel householdId="home" />);
        fireEvent.click(screen.getByText('Añadir objeto'));
        fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'TV' } });
        fireEvent.change(screen.getByLabelText('Estimado (€)'), { target: { value: '500' } });
        fireEvent.click(screen.getByText('Guardar'));
        await waitFor(() => expect(fixture.change).toHaveBeenCalledWith('items', [expect.objectContaining({ name: 'TV', estimated: 50000, actual: null, status: 'pending' })], false));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    it('filtra lo que falta y marca una compra preservando su estimación', async () => {
        fixture.data = { items: [{ id: 'tv', name: 'TV', category: 'Salón', status: 'pending', estimated: 50000 }, { id: 'sofa', name: 'Sofá', category: 'Salón', status: 'owned' }] };
        render(<HousePanel householdId="home" />);
        fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'pending' } });
        expect(screen.queryByText('Sofá')).not.toBeInTheDocument();
        fireEvent.click(screen.getByText('Marcar comprado'));
        fireEvent.change(screen.getByLabelText('Real (€)'), { target: { value: '700' } });
        fireEvent.click(screen.getByText('Guardar'));
        await waitFor(() => expect(fixture.change).toHaveBeenCalledWith('items', [expect.objectContaining({ status: 'purchased', estimated: 50000, actual: 70000 })], false));
    });
    it('permite cambiar una categoría existente sin filtrar las demás opciones', async () => {
        fixture.data = { items: [{ id: 'lamp', name: 'Lámpara', category: 'Baño', status: 'pending' }] };
        render(<HousePanel householdId="home" />);
        fireEvent.click(screen.getByLabelText('Editar Lámpara'));
        const selector = within(screen.getByRole('dialog')).getByLabelText('Categoría');
        expect(within(selector).getByRole('option', { name: 'Salón' })).toBeInTheDocument();
        fireEvent.change(selector, { target: { value: 'Salón' } });
        fireEvent.click(screen.getByText('Guardar'));
        await waitFor(() => expect(fixture.change).toHaveBeenCalledWith('items', [expect.objectContaining({ id: 'lamp', category: 'Salón' })], false));
    });
    it('permite crear una categoría y reutiliza nombres equivalentes', async () => {
        render(<HousePanel householdId="home" />);
        fireEvent.click(screen.getByText('Añadir objeto'));
        fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Lámpara' } });
        fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('Categoría'), { target: { value: '' } });
        fireEvent.change(screen.getByLabelText('Nueva categoría'), { target: { value: '  salon  ' } });
        fireEvent.click(screen.getByText('Guardar'));
        await waitFor(() => expect(fixture.change).toHaveBeenCalledWith('items', [expect.objectContaining({ category: 'Salón' })], false));
    });
    it('mantiene el formulario y muestra los errores al guardar', async () => {
        fixture.change.mockRejectedValue(new Error('Ya existe un objeto con ese nombre.'));
        render(<HousePanel householdId="home" />);
        fireEvent.click(screen.getByText('Añadir objeto'));
        fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'tv' } });
        fireEvent.click(screen.getByText('Guardar'));
        expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe');
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    it('pide confirmación al borrar y permite cancelar', () => {
        fixture.data = { items: [{ id: 'tv', name: 'TV', category: 'Salón', status: 'pending' }] };
        render(<HousePanel householdId="home" />);
        fireEvent.click(screen.getByLabelText('Eliminar TV'));
        fireEvent.click(within(screen.getByRole('dialog')).getByText('Cancelar'));
        expect(fixture.change).not.toHaveBeenCalled();
    });
    it('configura mensualidades y crea objetivos de ahorro', async () => {
        render(<HousePanel householdId="home" />);
        fireEvent.click(screen.getByText('Pagos y ahorro'));
        fireEvent.click(screen.getByText('Configurar mensualidades'));
        fireEvent.change(screen.getByLabelText('Importe (€)'), { target: { value: '800' } });
        fireEvent.change(screen.getByLabelText('Primer mes'), { target: { value: '2028-01' } });
        fireEvent.change(screen.getByLabelText('Último mes'), { target: { value: '2028-03' } });
        fireEvent.click(screen.getByText('Guardar'));
        await waitFor(() => expect(fixture.change).toHaveBeenCalledWith('payments', expect.arrayContaining([expect.objectContaining({ due: '2028-03-01', amount: 80000 })]), false));
        expect(fixture.change.mock.calls[0][1]).toHaveLength(3);
        fireEvent.click(screen.getByLabelText('Añadir objetivo'));
        fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Entrega' } });
        fireEvent.change(screen.getByLabelText('Saldo que queremos conservar (€)'), { target: { value: '30000' } });
        fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2028-03-31' } });
        fireEvent.click(screen.getByText('Guardar'));
        await waitFor(() => expect(fixture.change).toHaveBeenLastCalledWith('goals', [expect.objectContaining({ amount: 3000000, date: '2028-03-31' })], false));
    });
});
