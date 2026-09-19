import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import useBankImports from './useBankImports';
import { onSnapshot } from '../lib/firebase';
vi.mock('../lib/firebase', () => ({ db: {}, collection: (_, ...parts) => parts.join('/'), onSnapshot: vi.fn() }));
vi.mock('../lib/bankImportRepository', () => ({ bankImportsPath: id => ['households', id, 'bankExpenseImports'] }));

describe('Household isolation of bank reports', () => {
    beforeEach(() => vi.resetAllMocks());
    it('drops the old household immediately and ignores late callbacks after switching or signing out', () => {
        const callbacks = [];
        const unsubscribe = vi.fn();
        onSnapshot.mockImplementation((path, next) => { callbacks.push(next); return unsubscribe; });
        const view = renderHook(({ home, user }) => useBankImports(home, user), { initialProps: { home: 'h1', user: 'u1' } });
        const snapshot = { docs: [{ id: 'report', data: () => ({ createdAt: '2026-09-19', entries: [] }) }] };
        act(() => callbacks[0](snapshot));
        expect(view.result.current.reports).toHaveLength(1);
        view.rerender({ home: 'h2', user: 'u1' });
        expect(view.result.current.reports).toEqual([]);
        act(() => callbacks[0](snapshot));
        expect(view.result.current.reports).toEqual([]);
        expect(unsubscribe).toHaveBeenCalledOnce();
        view.rerender({ home: undefined, user: undefined });
        act(() => callbacks[1](snapshot));
        expect(view.result.current.reports).toEqual([]);
    });
    it('exposes permission errors instead of crashing the expense panel', () => {
        let fail;
        onSnapshot.mockImplementation((_, next, error) => { fail = error; return vi.fn(); });
        const view = renderHook(() => useBankImports('h1', 'u1'));
        act(() => fail(new Error('permission-denied')));
        expect(view.result.current.loading).toBe(false);
        expect(view.result.current.error).toContain('permisos');
    });
});
