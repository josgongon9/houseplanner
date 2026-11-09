export const HOUSE_STATUSES = { pending: 'Pendiente', gift: 'Regalo', purchased: 'Comprado', owned: 'Ya lo tenemos' };
export const INVENTORY_COLUMNS = { name: 'Objeto', category: 'Categoría', status: 'Estado', payer: 'Paga / regala', estimated: 'Estimado', actual: 'Real' };
export function compareHouseItems(a, b, key, direction = 'asc') {
    const value = item => key === 'status' ? (item.status === 'gift' && item.received ? 'Regalo recibido' : HOUSE_STATUSES[item.status]) : item[key];
    const av = value(a), bv = value(b);
    if (av == null && bv != null) return 1;
    if (bv == null && av != null) return -1;
    const result = ['estimated', 'actual'].includes(key) ? (av || 0) - (bv || 0) : String(av || '').localeCompare(String(bv || ''), 'es', { sensitivity: 'base', numeric: true });
    return result ? result * (direction === 'desc' ? -1 : 1) : a.name.localeCompare(b.name, 'es');
}
export const HOUSE_CATEGORIES = ['Electrodomésticos', 'Muebles', 'Cocina', 'Baño', 'Dormitorio', 'Salón', 'Decoración', 'Otros'];
export function houseCategories(data) {
    const names = data.categories || [...HOUSE_CATEGORIES, ...(data.items || []).map(item => item.category)];
    return [...new Map(['Otros', ...names].filter(Boolean).map(name => [houseName(name), name])).values()].sort((a, b) => a.localeCompare(b, 'es'));
}
export const houseName = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
export const money = cents => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format((cents || 0) / 100);
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export function cents(value, signed = false) {
    if (value === '' || value == null) return null;
    const n = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(n) || (!signed && n < 0) || Math.abs(n) > 100000000) throw new Error('Introduce un importe válido.');
    return Math.round(n * 100);
}
export const hasItem = item => ['purchased', 'owned'].includes(item.status) || (item.status === 'gift' && item.received);
export function inventoryTotals(items) {
    return items.reduce((s, i) => ({
        estimated: s.estimated + (i.estimated || 0), actual: s.actual + (i.actual || 0),
        pending: s.pending + (!hasItem(i) && i.status !== 'gift' ? (i.estimated || 0) : 0),
        difference: s.difference + (i.status === 'purchased' && i.actual != null && i.estimated != null ? i.actual - i.estimated : 0),
        missingPrices: s.missingPrices + (!hasItem(i) && i.status !== 'gift' && i.estimated == null ? 1 : 0),
    }), { estimated: 0, actual: 0, pending: 0, difference: 0, missingPrices: 0 });
}
export function monthlyPayments(start, end, amount, day = 1) {
    if (!/^\d{4}-\d{2}$/.test(start) || !/^\d{4}-\d{2}$/.test(end) || start > end || !amount || day < 1 || day > 31) throw new Error('Revisa el periodo, día e importe de las mensualidades.');
    const [sy, sm] = start.split('-').map(Number), [ey, em] = end.split('-').map(Number);
    const count = (ey - sy) * 12 + em - sm + 1;
    if (sm < 1 || sm > 12 || em < 1 || em > 12 || count > 600) throw new Error('El plan admite hasta 600 mensualidades.');
    return Array.from({ length: count }, (_, index) => {
        const date = new Date(sy, sm - 1 + index, 1);
        const year = date.getFullYear(), month = date.getMonth() + 1;
        const dateDay = Math.min(day, new Date(year, month, 0).getDate());
        const due = `${year}-${String(month).padStart(2, '0')}-${String(dateDay).padStart(2, '0')}`;
        return { id: `monthly-${due}`, name: 'Mensualidad', due, amount, paidOn: '', type: 'monthly' };
    });
}
export function houseProjection(data, target, asOf = today()) {
    const payments = data.payments || [], savings = data.savings || [];
    const paid = payments.filter(p => p.paidOn && p.paidOn <= asOf).reduce((s, p) => s + p.amount, 0);
    const contributed = savings.filter(s => s.date <= asOf).reduce((sum, s) => sum + s.amount, 0);
    const outstanding = payments.filter(p => !p.paidOn || p.paidOn > asOf);
    const due = outstanding.filter(p => p.due <= target).reduce((s, p) => s + p.amount, 0);
    const balance = contributed - paid;
    return { paid, balance, due, remaining: outstanding.reduce((s, p) => s + p.amount, 0), total: payments.reduce((s, p) => s + p.amount, 0), overdue: outstanding.filter(p => p.due < asOf).reduce((s, p) => s + p.amount, 0), projected: balance - due };
}
