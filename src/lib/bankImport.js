export const normalizeBankText = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

export function bankCategory(category, subcategory, categories) {
    const usable = categories.filter(item => item.id !== 'settlement');
    const find = names => usable.find(item => names.includes(normalizeBankText(item.name)) || names.includes(item.id));
    const sub = normalizeBankText(subcategory);
    const special = sub === 'bares y restaurantes' ? find(['dining', 'restaurante', 'restaurantes'])
        : sub === 'alimentacion' ? find(['groceries', 'supermercado', 'supermercados', 'supermecados']) : null;
    return (special || find([normalizeBankText(category)]) || find([sub]) || find(['other', 'otro', 'otros']))?.id || 'other';
}

export function bankAmount(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const text = String(value ?? '').trim().replace(/\s|€/g, '');
    if (!/^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(text)) throw new Error('Importe no válido');
    return Number(text.replace(/\./g, '').replace(',', '.'));
}

export function bankDate(value) {
    let y, m, d;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        y = value.getUTCFullYear(); m = value.getUTCMonth() + 1; d = value.getUTCDate();
    } else {
        const match = String(value ?? '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (!match) throw new Error('Fecha no válida');
        [, d, m, y] = match.map(Number);
    }
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) throw new Error('Fecha no válida');
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Locate the detailed table, never the category summary above it.
export function parseBankRows(rows, categories) {
    const required = ['fecha', 'categoria', 'subcategoria', 'importe', 'concepto'];
    const header = rows.findIndex(row => required.every(name => row.map(normalizeBankText).includes(name)));
    if (header < 0) throw new Error('No se encuentra la tabla de movimientos BBVA (Fecha, Categoría, Subcategoría, Importe y Concepto).');
    const columns = rows[header].map(normalizeBankText);
    const index = Object.fromEntries(required.map(name => [name, columns.indexOf(name)]));
    const entries = [];
    let excluded = 0;
    rows.slice(header + 1).forEach((row, offset) => {
        if (row.every(cell => cell == null || String(cell).trim() === '')) return;
        if (required.every(name => normalizeBankText(row[index[name]]) === name)) return;
        try {
            const amount = bankAmount(row[index.importe]);
            if (amount >= 0) { excluded++; return; }
            const title = String(row[index.concepto] ?? '').trim();
            if (!title) throw new Error('Concepto vacío');
            const bankCategoryName = String(row[index.categoria] ?? '').trim();
            const bankSubcategory = String(row[index.subcategoria] ?? '').trim();
            entries.push({ title, amount: Math.round(-amount * 100) / 100, date: bankDate(row[index.fecha]),
                category: bankCategory(bankCategoryName, bankSubcategory, categories), bankCategory: bankCategoryName, bankSubcategory });
        } catch (error) { throw new Error(`Fila ${header + offset + 2}: ${error.message}.`); }
    });
    if (!entries.length) throw new Error('El fichero no contiene salidas de dinero.');
    return { entries, excluded };
}

export const bankEntryKey = entry => JSON.stringify([entry.date, entry.title, Math.round(entry.amount * 100)]);
export async function bankReportId(entries) {
    const text = JSON.stringify(entries.map(bankEntryKey).sort());
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function countOverlappingEntries(entries, imports) {
    const counts = new Map();
    imports.flatMap(report => report.entries).forEach(entry => {
        const key = bankEntryKey(entry);
        counts.set(key, (counts.get(key) || 0) + 1);
    });
    return entries.filter(entry => {
        const key = bankEntryKey(entry);
        if (!counts.get(key)) return false;
        counts.set(key, counts.get(key) - 1);
        return true;
    }).length;
}

export function flattenBankImports(imports) {
    return imports.flatMap(report => report.entries.map((entry, index) => ({ ...entry, id: `${report.id}-${index}`, importId: report.id, source: 'bank' })));
}
