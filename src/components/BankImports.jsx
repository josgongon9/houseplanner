import React, { useState } from 'react';
import { Upload, Trash2, X } from 'lucide-react';
import { parseBankRows, bankReportId, countOverlappingEntries } from '../lib/bankImport';
import { saveBankImport, removeBankImport } from '../lib/bankImportRepository';

const euro = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
const total = entries => entries.reduce((sum, entry) => sum + Math.round(entry.amount * 100), 0) / 100;
const dateLabel = date => date.split('-').reverse().join('/');
const buttonClass = 'px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 disabled:opacity-40';

function EntriesTable({ entries, categories, onCategoryChange }) {
    return <div className="max-h-[480px] overflow-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm text-left"><thead className="sticky top-0 bg-slate-900 text-slate-400"><tr>
            {['Fecha', 'Concepto', 'Categoría', 'Importe'].map(label => <th key={label} className="p-3">{label}</th>)}
        </tr></thead><tbody>{entries.map((entry, index) => <tr key={entry.id || index} className="border-t border-slate-800">
            <td className="p-3 whitespace-nowrap">{dateLabel(entry.date)}</td><td className="p-3 break-words">{entry.title}</td>
            <td className="p-3">{onCategoryChange ? <select aria-label={`Categoría del movimiento ${index + 1}`} className="max-w-48 bg-slate-900 border border-slate-700 rounded-lg p-2" value={entry.category} onChange={event => onCategoryChange(index, event.target.value)}>
                {categories.filter(item => item.id !== 'settlement').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                {!categories.some(item => item.id === 'other') && <option value="other">Otro</option>}
            </select> : categories.find(item => item.id === entry.category)?.name || 'Otro'}</td>
            <td className="p-3 text-right whitespace-nowrap tabular-nums">{euro(entry.amount)}</td>
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
    const entries = reports.flatMap(report => report.entries.map((entry, index) => ({ ...entry, id: `${report.id}-${index}` })))
        .filter(entry => entry.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));

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

    return <section aria-label="Gastos de la cuenta común" className="hidden lg:block space-y-5">
        <div className="flex justify-between items-center gap-4"><h2 className="text-lg font-bold">Cuenta común</h2>
            <label className={`${buttonClass} flex items-center gap-2 ${busy || loading || loadError ? 'opacity-40' : 'cursor-pointer'}`}><Upload size={18} /> Importar BBVA
                <input aria-label="Importar informe BBVA" className="sr-only" type="file" accept=".xlsx" disabled={busy || loading || !!loadError} onChange={readFile} />
            </label>
        </div>
        {(error || loadError) && <p role="alert" className="text-rose-300">{error || loadError}</p>}
        {(busy || loading || message) && <p role="status" className="text-slate-400">{busy ? 'Procesando…' : loading ? 'Cargando…' : message}</p>}
        {preview && <div className="bg-surface p-5 rounded-2xl border border-emerald-500/40 space-y-4">
            <div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold break-all">{preview.fileName}</h3>
                <p className="text-sm text-slate-400 mt-2">{preview.entries.length} gastos · {euro(total(preview.entries))} · {preview.excluded} ingresos o importes cero excluidos</p></div>
                <button aria-label="Cancelar importación" disabled={busy} onClick={() => setPreview(null)} className={buttonClass}><X size={18} /></button></div>
            <fieldset disabled={busy}><EntriesTable entries={preview.entries} categories={categories} onCategoryChange={(index, category) => setPreview({ ...preview, entries: preview.entries.map((entry, i) => i === index ? { ...entry, category } : entry) })} /></fieldset>
            {overlap > 0 && <label className="flex items-start gap-3 text-amber-300 text-sm"><input type="checkbox" checked={allowOverlap} disabled={busy} onChange={event => setAllowOverlap(event.target.checked)} />{overlap} movimientos coinciden con otros informes. Incluirlos de nuevo.</label>}
            <button disabled={busy || loading || !!loadError || (overlap > 0 && !allowOverlap)} onClick={save} className="px-5 py-3 rounded-xl bg-emerald-500 text-white font-bold disabled:opacity-40">Importar {preview.entries.length} gastos</button>
        </div>}
        {reports.length > 0 && <div className="space-y-2"><h3 className="text-sm font-semibold text-slate-400">Ficheros importados</h3>{reports.map(report => <div key={report.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-700 bg-surface p-3">
            <div className="min-w-0"><p className="text-sm break-all">{report.fileName}</p><p className="text-xs text-slate-400 mt-1">{report.entries.length} gastos · {euro(total(report.entries))}</p></div>
            <button disabled={busy} aria-label={`Eliminar informe ${report.fileName}`} onClick={() => remove(report)} className={`${buttonClass} text-rose-300 shrink-0`}><Trash2 size={18} /></button>
        </div>)}</div>}
        <div className="flex justify-between text-sm text-slate-300"><span>{entries.length} gastos este mes</span><strong>{euro(total(entries))}</strong></div>
        {entries.length > 0 && <EntriesTable entries={entries} categories={categories} />}
    </section>;
}
