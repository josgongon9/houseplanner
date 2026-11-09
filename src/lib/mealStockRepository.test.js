import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearMealStock } from './mealStockRepository';
import { getDocs, query, where, writeBatch } from './firebase';

vi.mock('./firebase', () => ({
    db: {},
    collection: vi.fn((_, name) => name),
    where: vi.fn((...args) => args),
    query: vi.fn((...args) => args),
    getDocs: vi.fn(),
    writeBatch: vi.fn(),
}));

describe('clearMealStock', () => {
    beforeEach(() => vi.clearAllMocks());

    it('resets only quantities of meals in the selected household, in batches', async () => {
        const docs = Array.from({ length: 501 }, (_, index) => ({ ref: `meals/${index}` }));
        getDocs.mockResolvedValue({ docs });
        const batches = [];
        writeBatch.mockImplementation(() => {
            const batch = { update: vi.fn(), commit: vi.fn().mockResolvedValue() };
            batches.push(batch);
            return batch;
        });
        await clearMealStock('home-1');
        expect(where).toHaveBeenCalledWith('householdId', '==', 'home-1');
        expect(query).toHaveBeenCalled();
        expect(batches).toHaveLength(2);
        expect(batches[0].update).toHaveBeenCalledTimes(500);
        expect(batches[0].update).toHaveBeenCalledWith('meals/0', { quantity: 0 });
        expect(batches[1].update).toHaveBeenCalledWith('meals/500', { quantity: 0 });
        expect(batches.every(batch => batch.commit.mock.calls.length === 1)).toBe(true);
    });

    it('propagates write failures', async () => {
        getDocs.mockResolvedValue({ docs: [{ ref: 'meals/1' }] });
        writeBatch.mockReturnValue({ update: vi.fn(), commit: vi.fn().mockRejectedValue(new Error('offline')) });
        await expect(clearMealStock('home-1')).rejects.toThrow('offline');
    });
});
