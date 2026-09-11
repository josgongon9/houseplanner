import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Plus, Trash2, Check, Save, Wallet } from 'lucide-react';
import { db, doc, getDoc, setDoc } from '../lib/firebase';

const euro = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value / 100);
const colors = ['#818cf8', '#38bdf8', '#fbbf24', '#fb7185', '#c084fc', '#2dd4bf'];
const inputClass = 'w-full min-w-0 bg-slate-950/60 border border-slate-700 rounded-xl px-3 py-3 text-base text-white focus:outline-none focus:ring-2 focus:ring-amber-400';
const buttonClass = 'min-h-[44px] px-3 py-2 rounded-xl border border-slate-700 text-sm font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed';
const emptyPlan = () => ({ income: '', destinations: ['Inversión', 'Cuenta personal', 'Cuenta común'].map((name, id) => ({ id: String(id), name, amount: '', mode: 'fixed', done: false })) });
const periodKey = (year, month) => `${year}-${String(month + 1).padStart(2, '0')}`;
const planRef = (userId, period) => doc(db, 'users', userId, 'finance_years', `organization-${period}`);

export function calculateDistribution(plan) {
    const income = Math.round(Number(plan.income || 0) * 100);
    const destinations = plan.destinations.map(item => ({ ...item, cents: item.mode === 'percent'
        ? Math.round(income * Number(item.amount || 0) / 100)
        : Math.round(Number(item.amount || 0) * 100) }));
    const allocated = destinations.reduce((sum, item) => sum + item.cents, 0);
    return { income, destinations, allocated, remaining: income - allocated,
        pending: destinations.filter(item => !item.done).reduce((sum, item) => sum + item.cents, 0) };
}

export default function MoneyOrganization({ userId, onDirtyChange, onBusyChange }) {
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth());
    const [dirty, setDirty] = useState(false);
    const period = periodKey(year, month);
    const navigate = offset => {
        if (dirty && !window.confirm('Hay cambios sin guardar. ¿Descartarlos y cambiar de mes?')) return;
        const target = new Date(year, month + offset, 1);
        setDirty(false);
        onDirtyChange(false);
        setMonth(target.getMonth());
        setYear(target.getFullYear());
    };
    return <PlanEditor key={`${userId}-${period}`} userId={userId} period={period} year={year} month={month}
        onNavigate={navigate} onBusyChange={onBusyChange} onDirtyChange={value => { setDirty(value); onDirtyChange(value); }} />;
}

function PlanEditor({ userId, period, year, month, onNavigate, onDirtyChange, onBusyChange }) {
    const [plan, setPlan] = useState(emptyPlan);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [busy, setBusy] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [reload, setReload] = useState(0);
    const totals = calculateDistribution(plan);
    const monthLabel = new Date(year, month, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

    useEffect(() => {
        onBusyChange?.(busy);
        return () => onBusyChange?.(false);
    }, [busy, onBusyChange]);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setLoadError(false);
        getDoc(planRef(userId, period)).then(snap => {
            if (!active) return;
            setPlan(snap.exists() ? snap.data().plan : emptyPlan());
            setMessage(snap.exists() ? 'Plan guardado' : 'Mes nuevo · prepara tu reparto');
        }).catch(() => { if (active) setLoadError(true); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [userId, period, reload]);

    useEffect(() => {
        if (!dirty) return;
        const warn = event => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    const change = next => {
        setPlan(next);
        setDirty(true);
        onDirtyChange(true);
        setMessage('Cambios sin guardar');
        setError('');
    };
    const updateItem = (id, patch) => change({ ...plan, destinations: plan.destinations.map(item => item.id === id ? { ...item, ...patch } : item) });
    const copyPrevious = async () => {
        setBusy(true);
        setError('');
        try {
            const previous = new Date(year, month - 1, 1);
            const snap = await getDoc(planRef(userId, periodKey(previous.getFullYear(), previous.getMonth())));
            if (!snap.exists()) { setError('El mes anterior todavía no tiene un plan guardado.'); return; }
            if ((dirty || plan.income !== '' || plan.destinations.some(item => Number(item.amount) > 0)) &&
                !window.confirm('¿Sustituir este reparto por el del mes anterior?')) return;
            const previousPlan = snap.data().plan;
            change({ ...previousPlan, destinations: previousPlan.destinations.map(item => ({ ...item, done: false })) });
            setMessage('Mes anterior copiado. Ajusta los importes y guarda.');
        } catch { setError('No se pudo copiar el mes anterior. Vuelve a intentarlo.'); }
        finally { setBusy(false); }
    };
    const save = async event => {
        event.preventDefault();
        if (!Number.isFinite(Number(plan.income)) || Number(plan.income) < 0 || plan.destinations.some(item =>
            !item.name.trim() || !Number.isFinite(Number(item.amount)) || Number(item.amount) < 0 || (item.mode === 'percent' && Number(item.amount) > 100))) {
            setError('Revisa los nombres y los importes. Los porcentajes deben estar entre 0 y 100.');
            return;
        }
        setBusy(true);
        setError('');
        try {
            await setDoc(planRef(userId, period), { plan: {
                income: Number(plan.income),
                destinations: plan.destinations.map(item => ({ ...item, name: item.name.trim(), amount: Number(item.amount) })),
            } });
            setDirty(false);
            onDirtyChange(false);
            setMessage('Plan guardado');
        } catch { setError('No se pudo guardar. Tus cambios siguen aquí; vuelve a intentarlo.'); }
        finally { setBusy(false); }
    };

    return <section className="space-y-5" aria-label="Organización de mi dinero">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-bold text-white">Tu dinero, con destino</h2>
                <p className="text-sm text-slate-400 mt-1">Reparte tu nómina y deja claro lo que queda para ti.</p></div>
            <div className="flex items-center gap-1 rounded-xl bg-slate-900 border border-slate-700 p-1">
                <button type="button" disabled={busy} onClick={() => onNavigate(-1)} aria-label="Mes anterior" className="p-3 rounded-lg hover:bg-slate-800"><ChevronLeft size={18} /></button>
                <span className="capitalize text-sm font-semibold min-w-[145px] text-center">{monthLabel}</span>
                <button type="button" disabled={busy} onClick={() => onNavigate(1)} aria-label="Mes siguiente" className="p-3 rounded-lg hover:bg-slate-800"><ChevronRight size={18} /></button>
            </div>
        </div>
        {loading ? <p role="status" className="p-8 text-slate-400">Cargando tu reparto…</p> : loadError ?
            <div role="alert" className="p-6 rounded-2xl bg-slate-900 border border-rose-400/30 space-y-3"><p>No se pudo cargar este mes.</p><button className={buttonClass} onClick={() => setReload(value => value + 1)}>Reintentar</button></div> :
            <form onSubmit={save} className="space-y-5">
                <fieldset disabled={busy} className="space-y-5 min-w-0">
                    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
                        <div className="p-5 sm:p-6 bg-slate-900 border border-slate-700 rounded-2xl">
                            <label htmlFor="plan-income" className="flex items-center gap-2 text-sm font-semibold text-slate-300"><Wallet size={18} className="text-amber-400" /> Nómina neta del mes</label>
                            <div className="flex items-center gap-3 mt-3"><input id="plan-income" type="number" min="0" step="0.01" inputMode="decimal" required placeholder="0,00" value={plan.income}
                                onChange={event => change({ ...plan, income: event.target.value, destinations: plan.destinations.map(item => item.mode === 'percent' ? { ...item, done: false } : item) })} className={`${inputClass} !text-3xl font-semibold tabular-nums`} /><span className="text-xl text-slate-400">€</span></div>
                            <p className="mt-3 text-sm text-slate-400">El importe que recibes en tu cuenta.</p>
                        </div>
                        <div className={`p-5 sm:p-6 rounded-2xl border ${totals.remaining < 0 ? 'bg-rose-500/10 border-rose-400/40' : 'bg-emerald-500/10 border-emerald-400/30'}`}>
                            <p className="text-sm text-slate-300">{totals.remaining < 0 ? 'Te falta para este reparto' : 'Te queda disponible'}</p>
                            <p className={`mt-2 text-4xl sm:text-5xl font-semibold tracking-tight tabular-nums break-words ${totals.remaining < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{euro(Math.abs(totals.remaining))}</p>
                            <p className="mt-3 text-sm text-slate-300">{euro(totals.allocated)} repartidos{totals.income > 0 ? ` · ${(totals.allocated / totals.income * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })}% de tu nómina` : ''}</p>
                            {totals.remaining < 0 && <p role="alert" className="mt-2 text-sm text-rose-300">Has asignado más de lo que ingresas. Ajusta los destinos para equilibrar el mes.</p>}
                        </div>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
                        <div className="flex flex-wrap justify-between items-center gap-3"><div><h3 className="font-bold text-lg">Reparto de la nómina</h3><p className="text-sm text-slate-400 mt-1">Importes fijos o porcentajes que se adaptan a lo que cobres.</p></div>
                            <button type="button" className={`${buttonClass} flex items-center gap-2`} onClick={copyPrevious}><Copy size={16} /> Copiar mes anterior</button></div>
                        <div className="flex h-3 rounded-full overflow-hidden bg-slate-800" aria-label="Distribución de la nómina">
                            {totals.destinations.map((item, index) => <div key={item.id} style={{ backgroundColor: colors[index % colors.length], width: `${Math.max(0, item.cents) / Math.max(1, totals.income, totals.allocated) * 100}%` }} />)}
                            {totals.remaining > 0 && <div className="bg-emerald-400" style={{ width: `${totals.remaining / Math.max(1, totals.income) * 100}%` }} />}
                        </div>
                        <div className="space-y-3">
                            {totals.destinations.map((item, index) => <div key={item.id} className="rounded-xl border border-slate-700/70 bg-slate-900 p-3 sm:p-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,200px)_auto] items-end">
                                <label className="min-w-0"><span className="text-sm text-slate-400 flex items-center gap-2 mb-2"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} /> Destino {index + 1}</span>
                                    <input aria-label={`Nombre del destino ${index + 1}`} required maxLength={60} value={item.name} onChange={event => updateItem(item.id, { name: event.target.value })} className={inputClass} /></label>
                                <div><label htmlFor={`amount-${item.id}`} className="block text-sm text-slate-400 mb-2">{item.mode === 'percent' ? `${euro(item.cents)} este mes` : 'Importe a transferir'}</label>
                                    <div className="flex gap-2"><input id={`amount-${item.id}`} aria-label={`Importe del destino ${index + 1}`} type="number" min="0" max={item.mode === 'percent' ? 100 : undefined} step="0.01" inputMode="decimal" placeholder="0" value={item.amount} onChange={event => updateItem(item.id, { amount: event.target.value, done: false })} className={inputClass} />
                                        <select aria-label={`Tipo de importe del destino ${index + 1}`} value={item.mode} onChange={event => updateItem(item.id, { mode: event.target.value, done: false })} className="bg-slate-950 border border-slate-700 rounded-xl px-2 text-base"><option value="fixed">€</option><option value="percent">%</option></select></div></div>
                                <div className="flex items-center justify-between gap-2"><button type="button" aria-pressed={item.done} aria-label={`Transferencia ${item.name || index + 1} realizada`} onClick={() => updateItem(item.id, { done: !item.done })} className={`${buttonClass} flex items-center gap-2 ${item.done ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' : 'text-slate-400'}`}><Check size={16} />{item.done ? 'Hecha' : 'Pendiente'}</button>
                                    <button type="button" aria-label={`Eliminar destino ${index + 1}`} className="p-3 text-slate-500 hover:text-rose-300 rounded-xl hover:bg-rose-500/10" onClick={() => change({ ...plan, destinations: plan.destinations.filter(destination => destination.id !== item.id) })}><Trash2 size={18} /></button></div>
                            </div>)}
                        </div>
                        <button type="button" onClick={() => change({ ...plan, destinations: [...plan.destinations, { id: crypto.randomUUID(), name: '', amount: '', mode: 'fixed', done: false }] })} className={`${buttonClass} flex items-center gap-2 text-amber-300`}><Plus size={18} /> Añadir destino</button>
                        <div className="flex flex-wrap justify-between gap-3 pt-4 border-t border-slate-800 text-sm"><span className="text-slate-400">Por transferir <strong className="text-white ml-2">{euro(totals.pending)}</strong></span><span className="text-emerald-300">Disponible para ti <strong className="ml-2">{euro(totals.remaining)}</strong></span></div>
                    </div>
                </fieldset>
                <div className="flex flex-wrap justify-between items-center gap-3">
                    <div className="text-sm"><p role="status" className="text-slate-400">{busy ? 'Un momento…' : message}</p>{error && <p role="alert" className="text-rose-300 mt-1">{error}</p>}</div>
                    <button type="submit" disabled={busy || !dirty} className="min-h-[48px] w-full sm:w-auto flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-bold px-6 py-3 rounded-xl"><Save size={18} />{busy ? 'Guardando…' : 'Guardar reparto'}</button>
                </div>
                <p className="text-sm text-slate-500">Tu plan es personal. Marcar una transferencia como hecha sirve para llevar el control; no mueve dinero ni añade gastos.</p>
            </form>}
    </section>;
}
