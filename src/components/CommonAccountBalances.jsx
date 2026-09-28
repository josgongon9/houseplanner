import React, { useState } from 'react';
import { format, isSameMonth, parseISO } from 'date-fns';
import { Check, TrendingUp, Wallet } from 'lucide-react';
import Avatar from './Avatar';
import { isCommonExpense, pendingCents } from '../lib/commonAccount';
import { settleCommonMonth, undoCommonSettlement } from '../lib/commonAccountRepository';

const euro = value => `${(value / 100).toFixed(2)}€`;

export default function CommonAccountBalances({ expenses, members, householdId, userId, month }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const common = expenses.filter(expense => isCommonExpense(expense) && isSameMonth(parseISO(expense.date), month));
    const people = [...new Set([...members.map(member => member.id), ...common.map(expense => expense.payerId)])];
    const member = id => members.find(member => member.id === id);
    const name = id => member(id)?.displayName || 'Ex-miembro';
    const shortName = id => name(id).split(' ')[0];
    const balances = people.map(id => ({ id, amount: common.filter(expense => expense.payerId === id).reduce((sum, expense) => sum + pendingCents(expense), 0) }));
    const pending = balances.filter(balance => balance.amount > 0);
    const history = new Map();
    common.forEach(expense => (expense.reimbursements || []).forEach(item => {
        const key = `${expense.payerId}-${item.id}`;
        const group = history.get(key) || { id: item.id, payerId: expense.payerId, date: item.date, amount: 0, expenseIds: [] };
        group.amount += item.amountCents;
        group.expenseIds.push(expense.id);
        history.set(key, group);
    }));
    const settle = async balance => {
        if (busy || !window.confirm(`¿Confirmar que la cuenta común ha pagado ${euro(balance.amount)} a ${name(balance.id)}?`)) return;
        const items = common.filter(expense => expense.payerId === balance.id && pendingCents(expense) > 0).map(expense => ({ id: expense.id, amountCents: pendingCents(expense) }));
        setBusy(true); setError('');
        try {
            await settleCommonMonth(householdId, balance.id, format(month, 'yyyy-MM'), items, { id: crypto.randomUUID(), date: format(new Date(), 'yyyy-MM-dd'), createdBy: userId, createdAt: new Date().toISOString() });
        } catch (err) { setError(err.message || 'No se pudo registrar la liquidación.'); }
        finally { setBusy(false); }
    };
    const undo = async payment => {
        if (busy || !window.confirm('¿Anular esta liquidación de la CM y recuperar el saldo pendiente?')) return;
        setBusy(true); setError('');
        try { await undoCommonSettlement(householdId, payment.expenseIds, payment.id); }
        catch (err) { setError(err.message || 'No se pudo anular la liquidación.'); }
        finally { setBusy(false); }
    };
    return <section aria-label="Reembolsos de la cuenta común" className="space-y-4">
        <div className="bg-surface p-6 rounded-2xl border border-slate-700 space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2"><TrendingUp className="text-emerald-500" />Cuenta común · Mes</h3>
            {!pending.length && <div className="bg-green-500/20 text-green-400 p-3 rounded-xl text-sm font-bold flex items-center gap-2"><Check size={16} />Este mes está liquidado con la CM.</div>}
            <div className="space-y-4">{balances.map(balance => <div key={balance.id} className="flex items-center gap-3">
                <Avatar url={member(balance.id)?.photoURL} name={name(balance.id)} />
                <div className="flex-1 min-w-0"><div className="flex justify-between gap-3 items-end mb-1"><span className="font-medium text-sm break-words">{shortName(balance.id)}</span><span className={`font-bold whitespace-nowrap ${balance.amount ? 'text-green-400' : 'text-slate-500'}`}>{balance.amount ? '+' : ''}{euro(balance.amount)}</span></div>
                    {balance.amount > 0 && <div className="h-2 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(balance.amount / 100 * 3, 150)}px` }} /></div>}
                </div>
            </div>)}</div>
        </div>
        {error && <p role="alert" className="text-rose-300 text-sm">{error}</p>}
        <div className="space-y-2"><h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider pl-2">Cómo liquidar la cuenta común</h3>
            {!pending.length && <div className="p-4 rounded-xl border border-dashed border-slate-700 text-center text-slate-500 text-sm">Sin pagos pendientes de la CM</div>}
            {pending.map(balance => <div key={balance.id} className="bg-surface p-4 rounded-xl border border-slate-700 flex flex-col gap-3 shadow-sm">
                <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 min-w-0 flex-wrap"><div className="flex items-center gap-1"><div className="w-6 h-6 shrink-0 bg-slate-700 rounded-full flex items-center justify-center" aria-label="Cuenta común"><Wallet size={14} /></div><span className="font-bold text-slate-200 text-sm">CM</span></div><span className="text-xs text-slate-500">paga a</span><span className="font-bold text-slate-200 text-sm break-words">{name(balance.id)}</span></div><div className="text-xl font-bold text-white whitespace-nowrap">{euro(balance.amount)}</div></div>
                <button disabled={busy} onClick={() => settle(balance)} className="w-full py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-40">{busy ? 'GUARDANDO…' : 'MARCAR COMO PAGADO'}</button>
            </div>)}
        </div>
        {!!history.size && <details><summary className="cursor-pointer text-sm text-slate-400">Liquidaciones de la CM ({history.size})</summary><div className="mt-3 space-y-3">{[...history.values()].sort((a, b) => b.date.localeCompare(a.date)).map(payment => <div key={`${payment.payerId}-${payment.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700 p-3 text-sm"><div><p>CM → {name(payment.payerId)} · {euro(payment.amount)}</p><p className="text-slate-400">{payment.date.split('-').reverse().join('/')}</p></div><button disabled={busy} className="px-3 py-2 rounded-lg border border-slate-600 hover:bg-slate-800 disabled:opacity-40" onClick={() => undo(payment)}>Anular liquidación</button></div>)}</div></details>}
    </section>;
}
