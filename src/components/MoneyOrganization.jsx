import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Plus, Trash2, Save, Wallet } from 'lucide-react';
import { db, doc, getDoc, setDoc } from '../lib/firebase';

const euro = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value / 100);
const colors = ['#818cf8', '#38bdf8', '#fbbf24', '#fb7185', '#c084fc', '#2dd4bf'];
const inputClass = 'w-full min-w-0 bg-slate-950/60 border border-slate-700 rounded-xl px-3 py-3 text-base text-white focus:outline-none focus:ring-2 focus:ring-amber-400';
const buttonClass = 'min-h-[44px] px-3 py-2 rounded-xl border border-slate-700 text-sm font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed';
const emptyPlan = () => ({ income: '', destinations: ['Inversión', 'Cuenta personal', 'Cuenta común'].map((name, id) => ({ id: String(id), name, amount: '', mode: 'fixed' })) });
const organizationPlan = plan => ({ income: plan.income, destinations: plan.destinations.map(({ id, name, amount, mode }) => ({ id, name, amount, mode })) });
const periodKey = (year, month) => `${year}-${String(month + 1).padStart(2, '0')}`;
const planRef = (userId, period) => doc(db, 'users', userId, 'finance_years', `organization-${period}`);

export function calculateDistribution(plan) {
    const income = Math.round(Number(plan.income || 0) * 100);
    const destinations = plan.destinations.map(item => ({ ...item, cents: item.mode === 'percent'
        ? Math.round(income * Number(item.amount || 0) / 100)
        : Math.round(Number(item.amount || 0) * 100) }));
    const allocated = destinations.reduce((sum, item) => sum + item.cents, 0);
    return { income, destinations, allocated, remaining: income - allocated };
}

function DistributionChart({ totals }) {
    const segments = totals.destinations.map((item, index) => ({ ...item, color: colors[index % colors.length] }));
    if (totals.remaining > 0) segments.push({ id: 'available', name: 'Disponible', cents: totals.remaining, color: '#34d399' });
    const total = segments.reduce((sum, item) => sum + Math.max(0, item.cents), 0);
    let offset = 0;
    const stops = segments.filter(item => item.cents > 0).map(item => {
        const start = offset;
        offset += item.cents / total * 100;
        return `${item.color} ${start}% ${offset}%`;
    });
    return <figure aria-label="Distribución de la nómina" className="grid min-w-0 gap-6 py-2 sm:grid-cols-[200px_minmax(0,1fr)] items-center">
        <div aria-hidden="true" className="relative w-48 h-48 sm:w-[200px] sm:h-[200px] mx-auto rounded-full shrink-0" style={{ background: stops.length ? `conic-gradient(${stops.join(',')})` : '#334155' }}>
            <div className="absolute inset-5 rounded-full bg-slate-900 flex flex-col items-center justify-center px-3 text-center">
                <span className="text-xs text-slate-400">Repartido</span>
                <span className="mt-1 max-w-full break-words text-xl font-bold tabular-nums text-white">{euro(totals.allocated)}</span>
            </div>
        </div>
        <ul className="min-w-0 space-y-3">
            {segments.map((item, index) => <li key={item.id} className="min-w-0">
                <div className="flex items-start gap-2 text-sm">
                    <span className="mt-1 w-2.5 h-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="min-w-0 flex-1 break-words text-slate-200">{item.name || `Destino ${index + 1}`}</span>
                    <span className="shrink-0 text-right tabular-nums"><span className="block font-semibold text-white">{euro(item.cents)}</span><span className="text-xs text-slate-400">{(total ? Math.max(0, item.cents) / total * 100 : 0).toLocaleString('es-ES', { maximumFractionDigits: 1 })}%</span></span>
                </div>
                <div aria-hidden="true" className="mt-1.5 h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className="h-full rounded-full" style={{ backgroundColor: item.color, width: `${total ? Math.max(0, item.cents) / total * 100 : 0}%` }} /></div>
            </li>)}
        </ul>
    </figure>;
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
            setPlan(snap.exists() ? organizationPlan(snap.data().plan) : emptyPlan());
            setMessage(snap.exists() ? 'Plan guardado' : '');
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
            change(organizationPlan(previousPlan));
            setMessage('Mes anterior copiado · Sin guardar');
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
                                onChange={event => change({ ...plan, income: event.target.value })} className={`${inputClass} !text-3xl font-semibold tabular-nums`} /><span className="text-xl text-slate-400">€</span></div>
                        </div>
                        <div className={`p-5 sm:p-6 rounded-2xl border ${totals.remaining < 0 ? 'bg-rose-500/10 border-rose-400/40' : 'bg-emerald-500/10 border-emerald-400/30'}`}>
                            <p className="text-sm text-slate-300">{totals.remaining < 0 ? 'Te falta para este reparto' : 'Te queda disponible'}</p>
                            <p className={`mt-2 text-4xl sm:text-5xl font-semibold tracking-tight tabular-nums break-words ${totals.remaining < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{euro(Math.abs(totals.remaining))}</p>
                            <p className="mt-3 text-sm text-slate-300">{euro(totals.allocated)} repartidos{totals.income > 0 ? ` · ${(totals.allocated / totals.income * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })}% de tu nómina` : ''}</p>
                        </div>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
                        <div className="flex flex-wrap justify-between items-center gap-3"><h3 className="font-bold text-lg">Reparto de la nómina</h3>
                            <button type="button" className={`${buttonClass} flex items-center gap-2`} onClick={copyPrevious}><Copy size={16} /> Copiar mes anterior</button></div>
                        <DistributionChart totals={totals} />
                        <div className="space-y-3">
                            {totals.destinations.map((item, index) => <div key={item.id} className="rounded-xl border border-slate-700/70 bg-slate-900 p-3 sm:p-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,200px)_auto] items-end">
                                <label className="min-w-0"><span className="text-sm text-slate-400 flex items-center gap-2 mb-2"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} /> Destino {index + 1}</span>
                                    <input aria-label={`Nombre del destino ${index + 1}`} required maxLength={60} value={item.name} onChange={event => updateItem(item.id, { name: event.target.value })} className={inputClass} /></label>
                                <div><label htmlFor={`amount-${item.id}`} className="block text-sm text-slate-400 mb-2">{item.mode === 'percent' ? `${euro(item.cents)} este mes` : 'Importe'}</label>
                                    <div className="flex gap-2"><input id={`amount-${item.id}`} aria-label={`Importe del destino ${index + 1}`} type="number" min="0" max={item.mode === 'percent' ? 100 : undefined} step="0.01" inputMode="decimal" placeholder="0" value={item.amount} onChange={event => updateItem(item.id, { amount: event.target.value })} className={inputClass} />
                                        <select aria-label={`Tipo de importe del destino ${index + 1}`} value={item.mode} onChange={event => updateItem(item.id, { mode: event.target.value })} className="bg-slate-950 border border-slate-700 rounded-xl px-2 text-base"><option value="fixed">€</option><option value="percent">%</option></select></div></div>
                                <div className="flex items-center justify-end gap-2">
                                    <button type="button" aria-label={`Eliminar destino ${index + 1}`} className="p-3 text-slate-500 hover:text-rose-300 rounded-xl hover:bg-rose-500/10" onClick={() => change({ ...plan, destinations: plan.destinations.filter(destination => destination.id !== item.id) })}><Trash2 size={18} /></button></div>
                            </div>)}
                        </div>
                        <button type="button" onClick={() => change({ ...plan, destinations: [...plan.destinations, { id: crypto.randomUUID(), name: '', amount: '', mode: 'fixed' }] })} className={`${buttonClass} flex items-center gap-2 text-amber-300`}><Plus size={18} /> Añadir destino</button>
                    </div>
                </fieldset>
                <div className="flex flex-wrap justify-between items-center gap-3">
                    <div className="text-sm"><p role="status" className="text-slate-400">{busy ? 'Un momento…' : message}</p>{error && <p role="alert" className="text-rose-300 mt-1">{error}</p>}</div>
                    <button type="submit" disabled={busy || !dirty} className="min-h-[48px] w-full sm:w-auto flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-bold px-6 py-3 rounded-xl"><Save size={18} />{busy ? 'Guardando…' : 'Guardar reparto'}</button>
                </div>
            </form>}
    </section>;
}
