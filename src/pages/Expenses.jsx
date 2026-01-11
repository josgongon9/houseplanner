import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Plus, DollarSign, TrendingUp, Calendar, User, ArrowRightLeft, Check, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Expenses() {
    const { expenses, addExpense, householdMembers, user } = useStore();
    const [activeTab, setActiveTab] = useState('expenses'); // 'expenses' | 'balances'
    const [showAdd, setShowAdd] = useState(false);

    // Form State
    const [title, setTitle] = useState("");
    const [amount, setAmount] = useState("");
    const [category, setCategory] = useState("groceries");
    const [payerId, setPayerId] = useState(user?.uid || "");
    const [splitAmong, setSplitAmong] = useState([]); // Array of UIDs

    // Group expenses by month
    const groupedExpenses = useMemo(() => {
        const groups = {};
        expenses.forEach(exp => {
            const date = parseISO(exp.date);
            const key = format(date, 'MMMM yyyy', { locale: es });
            if (!groups[key]) groups[key] = [];
            groups[key].push(exp);
        });
        return groups;
    }, [expenses]);

    // Handle opening modal (reset split default to all members)
    const handleOpenAdd = () => {
        setSplitAmong(householdMembers.map(m => m.id));
        setPayerId(user.uid);
        setTitle("");
        setAmount("");
        setShowAdd(true);
    }

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!title || !amount) return;
        addExpense(title, amount, category, payerId, splitAmong);
        setShowAdd(false);
    };

    const toggleSplitMember = (memberId) => {
        if (splitAmong.includes(memberId)) {
            // Prevent removing if only 1 person left (cannot split with no one)
            if (splitAmong.length > 1) {
                setSplitAmong(splitAmong.filter(id => id !== memberId));
            }
        } else {
            setSplitAmong([...splitAmong, memberId]);
        }
    }

    // --- BALANCES LOGIC (Tricount Style) ---
    const balances = useMemo(() => {
        const balanceMap = {}; // uid -> amount (positive = owed, negative = owes)

        // Initialize 0
        householdMembers.forEach(m => balanceMap[m.id] = 0);

        expenses.forEach(exp => {
            const cost = exp.amount;
            const payer = exp.payerId;
            const beneficiaries = exp.splitAmong || []; // Fallback for old data?

            if (beneficiaries.length === 0) return; // Verified data only

            const splitAmount = cost / beneficiaries.length;

            // Payer paid full amount (+Credit)
            balanceMap[payer] = (balanceMap[payer] || 0) + cost;

            // Beneficiaries consumed share (-Debit)
            beneficiaries.forEach(uid => {
                balanceMap[uid] = (balanceMap[uid] || 0) - splitAmount;
            });
        });

        // Transform to array
        return Object.entries(balanceMap)
            .map(([uid, amount]) => ({
                uid,
                amount,
                member: householdMembers.find(m => m.id === uid)
            }))
            .sort((a, b) => b.amount - a.amount);
    }, [expenses, householdMembers]);

    // Calculate simple debts (Who pays whom)
    const transactions = useMemo(() => {
        let debtList = [];
        // Deep copy to avoid mutating state display
        let bals = balances.map(b => ({ ...b }));

        let i = 0;
        let j = bals.length - 1;

        while (i < j) {
            let debtor = bals[j];  // Most negative
            let creditor = bals[i]; // Most positive

            // Floating point protection
            if (Math.abs(debtor.amount) < 0.01) { j--; continue; }
            if (Math.abs(creditor.amount) < 0.01) { i++; continue; }

            let amount = Math.min(Math.abs(debtor.amount), creditor.amount);

            debtList.push({
                from: debtor.member,
                to: creditor.member,
                amount: amount
            });

            debtor.amount += amount;
            creditor.amount -= amount;

            if (Math.abs(debtor.amount) < 0.01) j--;
            if (Math.abs(creditor.amount) < 0.01) i++;
        }
        return debtList;
    }, [balances]);


    return (
        <div className="p-4 space-y-4 pb-24">
            <header className="flex justify-between items-center">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-600 bg-clip-text text-transparent">Gastos</h1>
                <button
                    onClick={handleOpenAdd}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-full shadow-lg transition-transform active:scale-95"
                >
                    <Plus size={24} />
                </button>
            </header>

            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-surface border border-slate-700 rounded-xl">
                <button
                    onClick={() => setActiveTab('expenses')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'expenses' ? 'bg-emerald-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                    Listado
                </button>
                <button
                    onClick={() => setActiveTab('balances')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'balances' ? 'bg-emerald-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                    Saldos
                </button>
            </div>

            {/* --- ADD EXPENSE MODAL --- */}
            {showAdd && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4">
                    <form onSubmit={handleSubmit} className="bg-surface w-full max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col shadow-2xl animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50 rounded-t-2xl">
                            <h3 className="font-bold text-lg text-emerald-400">Nuevo Gasto</h3>
                            <button type="button" onClick={() => setShowAdd(false)} className="p-2 bg-slate-800 rounded-full"><X size={20} /></button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Amount & Title */}
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Concepto</label>
                                    <input
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 focus:border-emerald-500 outline-none"
                                        value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Compra" autoFocus required
                                    />
                                </div>
                                <div className="w-32">
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Importe</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-3 text-emerald-500">€</span>
                                        <input
                                            type="number" step="0.01" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 pl-7 focus:border-emerald-500 outline-none text-right font-bold"
                                            value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Category */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Categoría</label>
                                <select
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 outline-none"
                                    value={category} onChange={e => setCategory(e.target.value)}
                                >
                                    <option value="groceries">🛒 Supermercado</option>
                                    <option value="dining">🍽️ Restaurante</option>
                                    <option value="transport">🚗 Transporte</option>
                                    <option value="home">🏠 Hogar</option>
                                    <option value="other">📦 Otro</option>
                                </select>
                            </div>

                            {/* Payer */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Pagado por</label>
                                <div className="bg-slate-900 border border-slate-700 rounded-xl p-2 flex gap-2 overflow-x-auto">
                                    {householdMembers.map(m => (
                                        <button
                                            type="button"
                                            key={m.id}
                                            onClick={() => setPayerId(m.id)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap border ${payerId === m.id ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-transparent text-slate-400 border-transparent hover:bg-slate-800'
                                                }`}
                                        >
                                            <Avatar url={m.photoURL} name={m.displayName} size="xs" />
                                            <span className="text-sm font-medium">{m.displayName?.split(' ')[0]}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Split */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-2">Para quién (Division)</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {householdMembers.map(m => {
                                        const isSelected = splitAmong.includes(m.id);
                                        return (
                                            <button
                                                type="button"
                                                key={m.id}
                                                onClick={() => toggleSplitMember(m.id)}
                                                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isSelected ? 'bg-slate-800 border-emerald-500/50 text-white' : 'bg-slate-900 border-slate-800 text-slate-500 opacity-70'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Avatar url={m.photoURL} name={m.displayName} size="xs" />
                                                    <span className="text-sm">{m.displayName?.split(' ')[0]}</span>
                                                </div>
                                                {isSelected && <Check size={16} className="text-emerald-500" />}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl hover:bg-emerald-600 mt-4 shadow-lg shadow-emerald-500/20">
                                Guardar Gasto
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* === LIST VIEW === */}
            {activeTab === 'expenses' && (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                    {Object.entries(groupedExpenses).map(([month, exps]) => (
                        <div key={month} className="space-y-2">
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider sticky top-16 bg-background/95 backdrop-blur py-2 z-10">{month}</h3>
                            {exps.map(exp => {
                                const payer = householdMembers.find(m => m.id === exp.payerId);
                                const isForEveryone = exp.splitAmong?.length === householdMembers.length;

                                return (
                                    <div key={exp.id} className="bg-surface p-4 rounded-xl border border-slate-700 flex justify-between items-center shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-3 rounded-xl ${exp.category === 'groceries' ? 'bg-orange-500/10 text-orange-400' :
                                                    exp.category === 'dining' ? 'bg-blue-500/10 text-blue-400' :
                                                        'bg-slate-700/50 text-slate-300'
                                                }`}>
                                                {exp.category === 'groceries' ? '🛒' : exp.category === 'dining' ? '🍽️' : '📦'}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-base">{exp.title}</h4>
                                                <div className="text-xs text-slate-400 flex flex-wrap gap-1 items-center mt-1">
                                                    <span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                        Pagado por {payer ? payer.displayName?.split(' ')[0] : '???'}
                                                    </span>
                                                    {!isForEveryone && (
                                                        <span className="text-slate-500">
                                                            • Para {exp.splitAmong.length} personas
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-emerald-400 font-bold text-lg">
                                            {exp.amount.toFixed(2)}€
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ))}

                    {expenses.length === 0 && (
                        <div className="text-center py-20 opacity-50 space-y-4">
                            <div className="bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-slate-600">
                                <DollarSign size={40} />
                            </div>
                            <p>No hay gastos aún.<br />¡Añade el primero!</p>
                        </div>
                    )}
                </div>
            )}

            {/* === BALANCES VIEW === */}
            {activeTab === 'balances' && (
                <div className="space-y-6 animate-in slide-in-from-left-4">

                    {/* Balances Bars */}
                    <div className="bg-surface p-6 rounded-2xl border border-slate-700 space-y-4">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <TrendingUp className="text-emerald-500" /> Balance
                        </h3>

                        <div className="space-y-4">
                            {balances.map(b => {
                                const isPositive = b.amount >= 0;
                                const barWidth = Math.min(Math.abs(b.amount) * 2, 100); // Visual scaling

                                return (
                                    <div key={b.uid} className="flex items-center gap-3">
                                        <Avatar url={b.member?.photoURL} name={b.member?.displayName} />
                                        <div className="flex-1">
                                            <div className="flex justify-between items-end mb-1">
                                                <span className="font-medium text-sm">{b.member?.displayName?.split(' ')[0]}</span>
                                                <span className={`font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                                    {isPositive ? '+' : ''}{b.amount.toFixed(2)}€
                                                </span>
                                            </div>
                                            {/* Bar */}
                                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
                                                {isPositive ? (
                                                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${barWidth}px` }}></div>
                                                ) : (
                                                    <div className="h-full bg-red-500 rounded-full ml-auto" style={{ width: `${barWidth}px` }}></div>
                                                )}
                                            </div>
                                            {isPositive ? (
                                                <p className="text-[10px] text-green-500/70 mt-1">Le deben dinero</p>
                                            ) : (
                                                <p className="text-[10px] text-red-500/70 mt-1">Debe dinero</p>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Transactions (How to settle) */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider pl-2">Cómo liquidar deudas</h3>
                        {transactions.length === 0 ? (
                            <div className="bg-surface p-4 rounded-xl border border-slate-700 text-center text-green-400 font-bold">
                                ¡Todo está cuadrado! 🎉
                            </div>
                        ) : (
                            transactions.map((t, idx) => (
                                <div key={idx} className="bg-surface p-4 rounded-xl border border-slate-700 flex items-center justify-between shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <Avatar url={t.from?.photoURL} name={t.from?.displayName} />
                                        <div className="text-slate-500">
                                            <ArrowRightLeft size={16} className="text-slate-600" />
                                        </div>
                                        <Avatar url={t.to?.photoURL} name={t.to?.displayName} />
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-slate-400">Paga a {t.to?.displayName?.split(' ')[0]}</div>
                                        <div className="text-xl font-bold text-white">{t.amount.toFixed(2)}€</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

const Avatar = ({ url, name, size = 'md' }) => {
    const s = size === 'xs' ? 'w-6 h-6' : 'w-10 h-10';
    if (!url) return <div className={`${s} bg-slate-700 rounded-full flex items-center justify-center`}><User size={size === 'xs' ? 14 : 20} /></div>
    return <img src={url} alt={name} className={`${s} rounded-full border border-slate-600`} />
}
