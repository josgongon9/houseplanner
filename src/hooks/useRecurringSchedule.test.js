import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useRecurringSchedule from './useRecurringSchedule';
vi.mock('../lib/recurringExpenses', () => ({ recurringMonthKey: date => `${date.getFullYear()}-${date.getMonth()}` }));

describe('Automatic recurring calendar', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
    it('uses the real month on opening and detects the first while the application stays open', async () => {
        vi.setSystemTime(new Date(2026, 8, 30, 23, 59, 30));
        const generate = vi.fn().mockResolvedValue(undefined);
        const rules = [];
        const view = renderHook(() => useRecurringSchedule(generate, true, rules));
        await act(async () => {});
        expect(generate.mock.calls[0][0].getMonth()).toBe(8);
        await act(async () => vi.advanceTimersByTimeAsync(60000));
        expect(generate).toHaveBeenCalledTimes(2);
        expect(generate.mock.calls[1][0].getMonth()).toBe(9);
        expect(generate.mock.calls[1][0].getDate()).toBe(1);
        await act(async () => vi.advanceTimersByTimeAsync(60000));
        expect(generate).toHaveBeenCalledTimes(2);
        view.unmount();
        expect(vi.getTimerCount()).toBe(0);
    });
    it('retries failures and rechecks changed rules without repeatedly generating on renders', async () => {
        vi.setSystemTime(new Date(2026, 9, 8));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const generate = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
        const view = renderHook(({ rules }) => useRecurringSchedule(generate, true, rules), { initialProps: { rules: [] } });
        await act(async () => {});
        await act(async () => vi.advanceTimersByTimeAsync(60000));
        expect(generate).toHaveBeenCalledTimes(2);
        view.rerender({ rules: [{ id: 'new-rule' }] });
        await act(async () => {});
        expect(generate).toHaveBeenCalledTimes(3);
        view.unmount();
    });
});
