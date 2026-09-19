import { db, doc, runTransaction, deleteDoc } from './firebase';
import { bankReportId } from './bankImport';

export const bankImportsPath = householdId => ['households', householdId, 'bankExpenseImports'];

export async function saveBankImport(householdId, userId, report) {
    if (!householdId || !userId) throw new Error('Selecciona un hogar e inicia sesión.');
    if (!report.entries.length) throw new Error('No hay gastos para importar.');
    // One document makes both import and removal atomic, including after connection failures.
    const payload = { fileName: report.fileName, entries: report.entries, createdBy: userId, createdAt: new Date().toISOString() };
    if (new TextEncoder().encode(JSON.stringify(payload)).length > 700000 || report.entries.length > 3000) {
        throw new Error('El informe es demasiado grande. Exporta un periodo más corto (máximo 3000 gastos).');
    }
    const id = await bankReportId(report.entries);
    const ref = doc(db, ...bankImportsPath(householdId), id);
    await runTransaction(db, async transaction => {
        if ((await transaction.get(ref)).exists()) throw new Error('Este informe ya está importado.');
        transaction.set(ref, payload);
    });
    return id;
}

export async function removeBankImport(householdId, importId) {
    if (!householdId || !importId) throw new Error('No se encuentra la importación.');
    await deleteDoc(doc(db, ...bankImportsPath(householdId), importId));
}
