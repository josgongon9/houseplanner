import React, { useState } from 'react';
import { Upload, Trash2, X } from 'lucide-react';
import { parseBankRows, bankReportId, countOverlappingEntries } from '../lib/bankImport';
import { saveBankImport, removeBankImport, updateBankEntryCategory } from '../lib/bankImportRepository';

const euro = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
const total = entries => entries.filter(entry => entry.category !== 'cm_reimbursement').reduce((sum, entry) => sum + Math.round(entry.amount * 100), 0) / 100;
const dateLabel = date => date.split('-').reverse().join('/');
const buttonClass = 'min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 disabled:opacity-40';

function EntriesTable({ entries, categories, onCategoryChange }) {
    return <div className="sm:max-h-[480px] sm:overflow-auto sm:rounded-xl sm:border sm:border-slate-700">
        <table className="block sm:table w-full text-sm text-left"><thead className="hidden sm:table-header-group sticky top-0 bg-slate-900 text-slate-400"><tr>
            {['Fecha', 'Concepto', 'Categoría', 'Importe'].map(label => <th key={label} className="p-3">{label}</th>)}
        </tr></thead><tbody className="block sm:table-row-group space-y-3 sm:space-y-0">{entries.map((entry, index) => <tr key={entry.id || index} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 p-3 rounded-xl border border-slate-700 bg-surface sm:table-row sm:p-0 sm:rounded-none sm:border-0 sm:border-t sm:border-slate-800">
            <td className="col-start-1 row-start-2 text-xs text-slate-400 sm:text-sm sm:p-3 whitespace-nowrap">{dateLabel(entry.date)}</td><td className="col-start-1 row-start-1 min-w-0 font-semibold sm:font-normal sm:p-3 break-words [overflow-wrap:anywhere]">{entry.title}</td>
            <td className="col-span-2 row-start-3 min-w-0 sm:p-3">{onCategoryChange ? <select aria-label={`Categoría del movimiento ${index + 1}`} className="w-full sm:w-48 min-w-0 min-h-[44px] bg-slate-900 border border-slate-700 rounded-lg p-2 text-base sm:text-sm focus:ring-2 focus:ring-emerald-400" value={entry.category} onChange={event => onCategoryChange(index, event.target.value)}>
                {categories.filter(item => item.id !== 'settlement').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                <option value="cm_reimbursement">Reembolso CM (no es gasto)</option>
                {!categories.some(item => item.id === 'other') && <option value="other">Otro</option>}
            </select> : entry.category === 'cm_reimbursement' ? 'Reembolso CM (no es gasto)' : categories.find(item => item.id === entry.category)?.name || 'Otro'}</td>
            <td className="col-start-2 row-start-1 text-right font-bold sm:font-normal sm:p-3 whitespace-nowrap tabular-nums">{euro(entry.amount)}</td>
        </tr>)}</tbody></table>
    </div>;
}

export default function BankImports({ householdId, userId, categories, reports, loading, loadError, month }) {
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [allowOverlap, setAllowOverlap] = useState(false);
    const overlap = preview ? countOverlappingEntries(preview.entries, reports) : 0;
    const entries = reports.flatMap(report => report.entries.map((entry, index) => ({ ...entry, id: `${report.id}-${index}`, importId: report.id, entryIndex: index })))
        .filter(entry => entry.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));

    const changeCategory = async (index, category) => {
        setBusy(true); setError(''); setMessage('');
        try { await updateBankEntryCategory(householdId, entries[index].importId, entries[index].entryIndex, category); setMessage('Movimiento actualizado'); }
        catch (err) { setError(err.message || 'No se pudo actualizar el movimiento.'); }
        finally { setBusy(false); }
    };
    const readFile = async event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setError(''); setMessage(''); setPreview(null); setAllowOverlap(false); setBusy(true);
        try {
            if (!/\.xlsx$/i.test(file.name)) throw new Error('Selecciona un fichero .xlsx.');
            if (file.size > 10 * 1024 * 1024) throw new Error('El fichero supera los 10 MB. Exporta un periodo más corto.');
            const { readSheet } = await import('read-excel-file/browser');
            const parsed = parseBankRows(await readSheet(file), categories);
            const id = await bankReportId(parsed.entries);
            if (reports.some(report => report.id === id)) throw new Error('Este informe ya está importado.');
            setPreview({ ...parsed, fileName: file.name });
        } catch (err) { setError(err.message || 'No se pudo leer el fichero.'); }
        finally { setBusy(false); }
    };
    const save = async () => {
        setBusy(true); setError('');
        try {
            await saveBankImport(householdId, userId, preview);
            setMessage(`${preview.entries.length} gastos importados`); setPreview(null);
        } catch (err) { setError(err.code === 'permission-denied' ? 'Firebase no permite guardar importaciones. Revisa las reglas de acceso.' : err.message); }
        finally { setBusy(false); }
    };
    const remove = async report => {
        if (!window.confirm(`¿Eliminar «${report.fileName}» y sus ${report.entries.length} gastos de todos los meses?`)) return;
        setBusy(true); setError(''); setMessage('');
        try { await removeBankImport(householdId, report.id); setMessage('Informe eliminado'); }
        catch { setError('No se pudo eliminar el informe. Vuelve a intentarlo.'); }
        finally { setBusy(false); }
    };

    return <section aria-label="Gastos de la cuenta común" className="min-w-0 space-y-5">
        <div className="flex flex-wrap justify-between items-center gap-3"><h2 className="text-lg font-bold">Cuenta común</h2>
            <label className={`${buttonClass} flex items-center justify-center gap-2 focus-within:ring-2 focus-within:ring-emerald-400 ${busy || loading || loadError ? 'opacity-40' : 'cursor-pointer'}`}><Upload size={18} /> Importar BBVA
                <input aria-label="Importar informe BBVA" className="sr-only" type="file" accept=".xlsx" disabled={busy || loading || !!loadError} onChange={readFile} />
            </label>
        </div>
        {(error || loadError) && <p role="alert" className="text-rose-300">{error || loadError}</p>}
        {(busy || loading || message) && <p role="status" className="text-slate-400">{busy ? 'Procesando…' : loading ? 'Cargando…' : message}</p>}
        {preview && <div className="bg-surface p-3 sm:p-5 rounded-2xl border border-emerald-500/40 space-y-4">
            <div className="flex items-start justify-between gap-4"><div className="min-w-0"><h3 className="font-semibold break-all">{preview.fileName}</h3>
                <p className="text-sm text-slate-400 mt-2">{preview.entries.length} gastos · {euro(total(preview.entries))} · {preview.excluded} ingresos o importes cero excluidos</p></div>
                <button aria-label="Cancelar importación" disabled={busy} onClick={() => setPreview(null)} className={`${buttonClass} shrink-0`}><X size={18} /></button></div>
            <fieldset disabled={busy} className="min-w-0"><EntriesTable entries={preview.entries} categories={categories} onCategoryChange={(index, category) => setPreview({ ...preview, entries: preview.entries.map((entry, i) => i === index ? { ...entry, category } : entry) })} /></fieldset>
            {overlap > 0 && <label className="flex items-start gap-3 text-amber-300 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-emerald-500" checked={allowOverlap} disabled={busy} onChange={event => setAllowOverlap(event.target.checked)} />{overlap} movimientos coinciden con otros informes. Incluirlos de nuevo.</label>}
            <button disabled={busy || loading || !!loadError || (overlap > 0 && !allowOverlap)} onClick={save} className="w-full sm:w-auto min-h-[44px] px-5 py-3 rounded-xl bg-emerald-500 text-white font-bold disabled:opacity-40">Importar {preview.entries.length} gastos</button>
        </div>}
        {reports.length > 0 && <div className="space-y-2"><h3 className="text-sm font-semibold text-slate-400">Ficheros importados</h3>{reports.map(report => <div key={report.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-700 bg-surface p-3">
            <div className="min-w-0"><p className="text-sm break-all">{report.fileName}</p><p className="text-xs text-slate-400 mt-1">{report.entries.length} gastos · {euro(total(report.entries))}</p></div>
            <button disabled={busy} aria-label={`Eliminar informe ${report.fileName}`} onClick={() => remove(report)} className={`${buttonClass} text-rose-300 shrink-0`}><Trash2 size={18} /></button>
        </div>)}</div>}
        <div className="flex justify-between text-sm text-slate-300"><span>{entries.length} gastos este mes</span><strong>{euro(total(entries))}</strong></div>
        {!loading && !loadError && !entries.length && <p className="py-6 text-center text-sm text-slate-400">Sin movimientos este mes</p>}
        {entries.length > 0 && <fieldset disabled={busy} className="min-w-0"><EntriesTable entries={entries} categories={categories} onCategoryChange={changeCategory} /></fieldset>}
    </section>;
}
