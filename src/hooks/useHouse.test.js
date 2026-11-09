import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useHouse from './useHouse';
const mock = vi.hoisted(() => ({ data: {}, update: vi.fn(), stop: vi.fn(), subscribe: vi.fn() }));
vi.mock('../lib/firebase', () => ({
    db: {}, doc: (_, collection, id) => `${collection}/${id}`,
    onSnapshot: (ref, next, error) => { mock.subscribe(ref, next, error); next({ exists: () => true, data: () => mock.data }); return mock.stop; },
    runTransaction: async (_, action) => action({ get: async () => ({ exists: () => true, data: () => mock.data }), update: mock.update }),
}));
describe('Casa: persistencia compartida', () => {
    it('rechaza comprados sin precio real aunque se omita la validación del formulario', async () => {
        const { result } = renderHook(() => useHouse('home'));
        await expect(result.current.change('items', [{ id: 'new', name: 'TV', status: 'purchased', actual: null }])).rejects.toThrow('precio real');
        expect(mock.update).not.toHaveBeenCalled();
        await result.current.change('items', [{ id: 'new', name: 'TV', status: 'purchased', actual: 0 }]);
        expect(mock.update).toHaveBeenCalled();
    });
    it('crea categorías vacías y rechaza nombres duplicados normalizados', async () => {
        const { result } = renderHook(() => useHouse('home'));
        await result.current.manageCategory('Terraza');
        expect(mock.update).toHaveBeenLastCalledWith('households/home', { 'houseModule.categories': expect.arrayContaining(['Terraza', 'Otros']) });
        await expect(result.current.manageCategory('  SALON ')).rejects.toThrow('Ya existe');
    });
    it('elimina la categoría y reasigna objetos de forma atómica conservando sus precios', async () => {
        mock.data = { houseModule: { items: [{ id: 'one', name: 'TV', category: 'Salón', actual: 70000, version: 1 }] } };
        const { result } = renderHook(() => useHouse('home'));
        await result.current.manageCategory('Salón', true);
        const update = mock.update.mock.calls[0][1];
        expect(update['houseModule.categories']).not.toContain('Salón');
        expect(update['houseModule.items']).toEqual([{ id: 'one', name: 'TV', category: 'Otros', actual: 70000, version: 2 }]);
        await expect(result.current.manageCategory('Otros', true)).rejects.toThrow('no se puede eliminar');
    });
    it('no permite que un formulario antiguo recree una categoría eliminada', async () => {
        mock.data = { houseModule: { categories: ['Otros'], items: [] } };
        const { result } = renderHook(() => useHouse('home'));
        await expect(result.current.change('items', [{ id: 'new', name: 'TV', category: 'Salón' }])).rejects.toThrow('categoría ha cambiado');
        expect(mock.update).not.toHaveBeenCalled();
    });
    it('guarda una categoría nueva y su objeto en la misma transacción', async () => {
        mock.data = { houseModule: { categories: ['Otros'] } };
        const { result } = renderHook(() => useHouse('home'));
        await result.current.change('items', [{ id: 'new', name: 'Mesa', category: 'Terraza' }], false, true);
        expect(mock.update).toHaveBeenCalledWith('households/home', {
            'houseModule.categories': ['Otros', 'Terraza'],
            'houseModule.items': [{ id: 'new', name: 'Mesa', category: 'Terraza', version: 1 }],
        });
    });
    beforeEach(() => { mock.data = {}; mock.update.mockClear(); mock.stop.mockClear(); mock.subscribe.mockClear(); });
    it('impide duplicados utilizando los datos actuales de la transacción', async () => {
        const { result } = renderHook(() => useHouse('home'));
        mock.data = { houseModule: { items: [{ id: 'one', name: 'TV', version: 1 }] } };
        await expect(result.current.change('items', [{ id: 'two', name: ' tv ' }])).rejects.toThrow('Ya existe');
        expect(mock.update).not.toHaveBeenCalled();
    });
    it('no sobrescribe cambios de otro miembro ni recrea registros borrados', async () => {
        mock.data = { houseModule: { items: [{ id: 'one', name: 'TV', version: 2 }] } };
        const { result } = renderHook(() => useHouse('home'));
        await expect(result.current.change('items', [{ id: 'one', name: 'TV', version: 1 }])).rejects.toThrow('ha cambiado');
        await expect(result.current.change('items', [{ id: 'removed', name: 'Mesa', version: 1 }])).rejects.toThrow('eliminado');
        expect(mock.update).not.toHaveBeenCalled();
    });
    it('escribe únicamente la sección de Casa conservando los registros de otros miembros', async () => {
        mock.data = { name: 'Hogar', houseModule: { items: [{ id: 'one', name: 'TV', version: 1 }], savings: [{ id: 'saving' }] } };
        const { result } = renderHook(() => useHouse('home'));
        await result.current.change('items', [{ id: 'two', name: 'Mesa' }]);
        expect(mock.update).toHaveBeenCalledWith('households/home', { 'houseModule.items': [{ id: 'one', name: 'TV', version: 1 }, { id: 'two', name: 'Mesa', version: 1 }] });
    });
    it('evita duplicar mensualidades del mismo mes con días diferentes', async () => {
        mock.data = { houseModule: { payments: [{ id: 'one', due: '2028-01-01', type: 'monthly' }] } };
        const { result } = renderHook(() => useHouse('home'));
        await expect(result.current.change('payments', [{ id: 'two', due: '2028-01-15', type: 'monthly' }])).rejects.toThrow('mensualidad');
    });
    it('cancela la suscripción al cambiar de hogar', async () => {
        const { result, rerender } = renderHook(({ id }) => useHouse(id), { initialProps: { id: 'home' } });
        mock.data = { houseModule: { items: [{ id: 'new' }] } };
        rerender({ id: 'other' });
        await waitFor(() => expect(result.current.data.items).toEqual([{ id: 'new' }]));
        expect(mock.stop).toHaveBeenCalledOnce();
    });
});
