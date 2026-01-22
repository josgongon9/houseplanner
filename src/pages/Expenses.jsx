import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Plus, ArrowLeft, DollarSign, TrendingUp, Calendar, User, ArrowRightLeft, Check, X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Lock, Unlock, Grid, PieChart as PieChartIcon, Trash, Edit, Divide, Percent, Zap, Flame, Droplets, BarChart2, Home, Settings, Palette, GripVertical } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, addMonths, isSameMonth, startOfYear, endOfYear, eachMonthOfInterval, isFuture, isPast, isThisMonth, addYears, subYears } from 'date-fns';
import { es } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const DEFAULT_CATEGORIES = [
    { id: 'groceries', name: 'Supermercado', icon: '🛒', color: '#F97316' },
    { id: 'dining', name: 'Restaurante', icon: '🍽️', color: '#3B82F6' },
    { id: 'transport', name: 'Transporte', icon: '🚗', color: '#8B5CF6' },
    { id: 'home', name: 'Hogar', icon: '🏠', color: '#F59E0B' },
    { id: 'settlement', name: 'Liquidación', icon: '🤝', color: '#10B981' },
    { id: 'GAS', name: 'Gas', icon: '🔥', color: '#EF4444' },
    { id: 'AGUA', name: 'Agua', icon: '💧', color: '#3B82F6' },
    { id: 'LUZ', name: 'Luz', icon: '⚡', color: '#F59E0B' },
    { id: 'other', name: 'Otro', icon: '📦', color: '#64748B' }
];

export default function Expenses() {
    const { expenses, addExpense, updateExpense, deleteExpense, householdMembers, user, household, addExpenseCategory, deleteExpenseCategory, updateAllExpenseCategories, updateHouseStatsCategories, updateHouseStatsPeriod, updateHouseStatsCategoryColor } = useStore();
    const [viewMode, setViewMode] = useState('month'); // 'month' | 'year'
    const [activeTab, setActiveTab] = useState('expenses'); // 'expenses' | 'balances' | 'charts' | 'house'
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Use stored categories if available, otherwise use defaults
    const categories = useMemo(() => {
        const storedCategories = household?.expenseCategories;
        if (storedCategories && storedCategories.length > 0) {
            return storedCategories;
        }
        return DEFAULT_CATEGORIES;
    }, [household]);

    // Modal State
    const [showAdd, setShowAdd] = useState(false);
    const [editingId, setEditingId] = useState(null); // ID of expense being edited
    const [showHouseSettings, setShowHouseSettings] = useState(false);

    // Form State
    const [title, setTitle] = useState("");
    const [amount, setAmount] = useState("");
    const [category, setCategory] = useState("");
    const [payerId, setPayerId] = useState(user?.uid || "");
    const [splitAmong, setSplitAmong] = useState([]); // Array of UIDs
    const [splitMode, setSplitMode] = useState('equal'); // 'equal' | 'custom'
    const [customAmounts, setCustomAmounts] = useState({}); // { uid: amount }

    // New Category State
    const [newCatName, setNewCatName] = useState("");
    const [newCatIcon, setNewCatIcon] = useState("📦");
    const [editingCategoryId, setEditingCategoryId] = useState(null);
    const [editCatName, setEditCatName] = useState("");
    const [editCatIcon, setEditCatIcon] = useState("");

    // Filter expenses by selected month
    const monthlyExpenses = useMemo(() => {
        return expenses.filter(exp => isSameMonth(parseISO(exp.date), currentMonth));
    }, [expenses, currentMonth]);

    // Handle opening modal for CREATE
    const handleOpenAdd = () => {
        setEditingId(null);
        setSplitAmong(householdMembers.map(m => m.id));
        setPayerId(user.uid);
        setTitle("");
        setAmount("");
        setCategory("");
        setSplitMode('equal');
        setCustomAmounts({});
        setShowAdd(true);
    }

    // Handle opening modal for EDIT
    const handleEdit = (exp) => {
        setEditingId(exp.id);
        setTitle(exp.title);
        setAmount(exp.amount);
        setCategory(exp.category);
        setPayerId(exp.payerId);
        setSplitAmong(exp.splitAmong || []);
        setSplitMode(exp.splitMode || 'equal');
        setCustomAmounts(exp.customAmounts || {});
        setShowAdd(true);
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title || !amount || !category) return;
        if (Number(amount) <= 0) return;

        // Custom Split Validation
        if (splitMode === 'custom') {
            const sum = Object.values(customAmounts).reduce((acc, curr) => acc + Number(curr), 0);
            if (Math.abs(sum - Number(amount)) > 0.05) {
                return;
            }
        }

        const data = {
            title,
            amount: Number(amount),
            category,
            payerId,
            splitAmong: splitMode === 'equal' ? splitAmong : Object.keys(customAmounts).filter(k => Number(customAmounts[k]) > 0),
            splitMode,
            customAmounts: splitMode === 'custom' ? customAmounts : {}
        };

        if (editingId) {
            await updateExpense(editingId, data);
        } else {
            // Use currentMonth but preserve today's day/time if we are in the current month
            let expenseDate = new Date().toISOString();
            if (!isThisMonth(currentMonth)) {
                // If we are in another month, use the 1st of that month at noon to avoid timezone issues
                const targetDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1, 12, 0, 0);
                expenseDate = targetDate.toISOString();
            }
            await addExpense(data.title, data.amount, data.category, data.payerId, data.splitAmong, data.splitMode, data.customAmounts, expenseDate);
        }
        setShowAdd(false);
        setEditingId(null);
    };

    const handleDelete = async () => {
        if (!editingId) return;
        if (confirm("¿Seguro que quieres eliminar este gasto?")) {
            await deleteExpense(editingId);
            setShowAdd(false);
            setEditingId(null);
        }
    }

    const handleSettleUp = (debtor, creditor, amount) => {
        const confirmMsg = `¿Confirmar que ${debtor.displayName} ha pagado ${amount.toFixed(2)}€ a ${creditor.displayName}?`;
        if (window.confirm(confirmMsg)) {
            const settlementTitle = `Liquidación ${format(currentMonth, 'MMMM', { locale: es })}`;
            addExpense(settlementTitle, amount, 'settlement', debtor.id, [creditor.id]);
        }
    }

    const toggleSplitMember = (memberId) => {
        if (splitAmong.includes(memberId)) {
            if (splitAmong.length > 1) {
                setSplitAmong(splitAmong.filter(id => id !== memberId));
            }
        } else {
            setSplitAmong([...splitAmong, memberId]);
        }
    }

    const sanitizeAmount = (val) => {
        if (!val) return "";
        if (val.includes('.')) {
            const parts = val.split('.');
            if (parts[1].length > 2) {
                return parts[0] + '.' + parts[1].substring(0, 2);
            }
        }
        return val;
    };

    const handleCustomAmountChange = (uid, val) => {
        setCustomAmounts(prev => ({
            ...prev,
            [uid]: sanitizeAmount(val)
        }));
    };

    const customSum = useMemo(() => {
        return Object.values(customAmounts).reduce((acc, curr) => acc + (Number(curr) || 0), 0);
    }, [customAmounts]);

    const isValidCustom = Math.abs(customSum - Number(amount)) < 0.05;

    // --- BALANCES LOGIC (Tricount Style) ---
    const balances = useMemo(() => {
        const balanceMap = {};
        householdMembers.forEach(m => balanceMap[m.id] = 0);

        monthlyExpenses.forEach(exp => {
            const cost = Number(exp.amount);
            const payer = exp.payerId;
            const beneficiaries = exp.splitAmong || [];

            if (!balanceMap.hasOwnProperty(payer)) balanceMap[payer] = 0;
            balanceMap[payer] += cost;

            if (exp.splitMode === 'custom' && exp.customAmounts) {
                Object.entries(exp.customAmounts).forEach(([uid, amt]) => {
                    if (!balanceMap.hasOwnProperty(uid)) balanceMap[uid] = 0;
                    balanceMap[uid] -= Number(amt);
                });
            } else {
                if (beneficiaries.length === 0) return;
                const splitAmount = cost / beneficiaries.length;
                beneficiaries.forEach(uid => {
                    if (!balanceMap.hasOwnProperty(uid)) balanceMap[uid] = 0;
                    balanceMap[uid] -= splitAmount;
                });
            }
        });

        return Object.entries(balanceMap)
            .map(([uid, amount]) => ({
                uid,
                amount: Math.round(amount * 100) / 100,
                member: householdMembers.find(m => m.id === uid) || { id: uid, displayName: 'Ex-miembro' }
            }))
            .sort((a, b) => b.amount - a.amount);
    }, [monthlyExpenses, householdMembers]);

    const transactions = useMemo(() => {
        let debtList = [];
        let bals = balances.map(b => ({
            ...b,
            cents: Math.round(b.amount * 100)
        }));

        bals.sort((a, b) => b.cents - a.cents);

        let i = 0;
        let j = bals.length - 1;

        while (i < j) {
            let creditor = bals[i];
            let debtor = bals[j];

            if (creditor.cents <= 0) { i++; continue; }
            if (debtor.cents >= 0) { j--; continue; }

            let amountCents = Math.min(creditor.cents, Math.abs(debtor.cents));

            if (amountCents > 0) {
                debtList.push({
                    from: debtor.member,
                    to: creditor.member,
                    amount: amountCents / 100
                });

                creditor.cents -= amountCents;
                debtor.cents += amountCents;
            }

            if (creditor.cents === 0) i++;
            if (debtor.cents === 0) j--;
        }
        return debtList;
    }, [balances]);

    const totalMonthly = monthlyExpenses
        .filter(e => e.category !== 'settlement')
        .reduce((acc, curr) => acc + Number(curr.amount), 0);

    const isSettled = transactions.length === 0 && monthlyExpenses.length > 0;

    // --- YEAR OVERVIEW DATA ---
    const yearMonths = useMemo(() => {
        const start = startOfYear(currentMonth);
        const end = endOfYear(currentMonth);
        return eachMonthOfInterval({ start, end });
    }, [currentMonth]);

    const getMonthTotal = (monthDate) => {
        return expenses
            .filter(e => isSameMonth(parseISO(e.date), monthDate) && e.category !== 'settlement')
            .reduce((acc, curr) => acc + Number(curr.amount), 0);
    };

    const individualPaid = useMemo(() => {
        const expenseMap = {};
        householdMembers.forEach(m => expenseMap[m.id] = 0);

        monthlyExpenses.forEach(exp => {
            if (exp.category === 'settlement') return;

            const splitAmong = exp.splitAmong || [];
            const splitMode = exp.splitMode || 'equal';
            const customAmounts = exp.customAmounts || {};
            const amount = Number(exp.amount);

            if (splitMode === 'custom') {
                // Use custom amounts
                Object.entries(customAmounts).forEach(([uid, amt]) => {
                    expenseMap[uid] = (expenseMap[uid] || 0) + Number(amt);
                });
            } else {
                // Equal split among participants
                const perPerson = splitAmong.length > 0 ? amount / splitAmong.length : 0;
                splitAmong.forEach(uid => {
                    expenseMap[uid] = (expenseMap[uid] || 0) + perPerson;
                });
            }
        });

        return Object.entries(expenseMap).map(([uid, amount]) => ({
            uid,
            amount,
            member: householdMembers.find(m => m.id === uid)
        })).sort((a, b) => b.amount - a.amount);
    }, [monthlyExpenses, householdMembers]);

    const individualChartData = useMemo(() => {
        const colors = ['#10B981', '#3B82F6', '#F59E0B', '#F97316', '#8B5CF6', '#EC4899'];
        return individualPaid
            .filter(p => p.amount > 0)
            .map((p, i) => ({
                name: p.member?.displayName?.split(' ')[0] || '???',
                value: p.amount,
                color: colors[i % colors.length]
            }));
    }, [individualPaid]);

    const chartData = useMemo(() => {
        const data = {};
        categories.forEach(c => {
            if (c.id !== 'settlement') data[c.id] = 0;
        });

        monthlyExpenses.forEach(e => {
            if (e.category === 'settlement') return;
            if (data[e.category] !== undefined) {
                data[e.category] += Number(e.amount);
            } else {
                data.other = (data.other || 0) + Number(e.amount);
            }
        });

        return categories
            .filter(c => c.id !== 'settlement' && data[c.id] > 0)
            .map(c => ({
                name: c.name,
                icon: c.icon,
                value: data[c.id],
                color: c.color
            }))
            .sort((a, b) => b.value - a.value);
    }, [monthlyExpenses, categories]);

    const statsCategoryIds = useMemo(() => {
        return household?.houseStatsCategories || ['LUZ', 'AGUA', 'GAS'];
    }, [household]);

    const statsCategories = useMemo(() => {
        const customColors = household?.houseStatsCategoryColors || {};
        return statsCategoryIds.map(id => {
            const cat = categories.find(c => c.id === id);
            if (!cat) return null;
            return {
                ...cat,
                color: customColors[id] || cat.color
            };
        }).filter(Boolean);
    }, [statsCategoryIds, categories, household?.houseStatsCategoryColors]);

    const yearUtilityData = useMemo(() => {
        let start, end;
        if (household?.houseStatsPeriod?.mode === 'custom' && household.houseStatsPeriod.start && household.houseStatsPeriod.end) {
            start = startOfMonth(parseISO(household.houseStatsPeriod.start));
            end = endOfMonth(parseISO(household.houseStatsPeriod.end));
        } else {
            start = startOfYear(currentMonth);
            end = endOfYear(currentMonth);
        }

        const monthsInInterval = eachMonthOfInterval({ start, end });

        return monthsInInterval.map(m => {
            const mExpenses = expenses.filter(e => isSameMonth(parseISO(e.date), m));
            const monthData = {
                name: format(m, 'MMM', { locale: es }).toUpperCase(),
                selectedTotal: 0,
                absoluteTotal: mExpenses
                    .filter(e => e.category !== 'settlement')
                    .reduce((acc, curr) => acc + Number(curr.amount), 0)
            };

            statsCategoryIds.forEach(catId => {
                const amount = mExpenses.filter(e => e.category === catId).reduce((acc, curr) => acc + Number(curr.amount), 0);
                monthData[catId] = amount;
                monthData.selectedTotal += amount;
            });

            return monthData;
        });
    }, [expenses, currentMonth, statsCategoryIds, household?.houseStatsPeriod]);

    const statsTitle = useMemo(() => {
        if (household?.houseStatsPeriod?.mode === 'custom' && household.houseStatsPeriod.start && household.houseStatsPeriod.end) {
            const start = parseISO(household.houseStatsPeriod.start);
            const end = parseISO(household.houseStatsPeriod.end);
            return `${format(start, 'MMM yy', { locale: es })} - ${format(end, 'MMM yy', { locale: es })}`;
        }
        return format(currentMonth, 'yyyy');
    }, [household?.houseStatsPeriod, currentMonth]);

    const yearlyUtilityTotals = useMemo(() => {
        const totals = {};
        statsCategoryIds.forEach(catId => {
            totals[catId] = yearUtilityData.reduce((acc, curr) => acc + (curr[catId] || 0), 0);
        });
        return totals;
    }, [yearUtilityData, statsCategoryIds]);

    return (
        <div className="p-4 space-y-4 pb-24">

            <header className="flex justify-between items-center mb-2">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-600 bg-clip-text text-transparent">Gastos</h1>
                <div className="flex gap-2">
                    {activeTab === 'house' && (
                        <button
                            onClick={() => setActiveTab('expenses')}
                            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700 shadow-sm mr-2"
                        >
                            <ArrowLeft size={16} /> Volver
                        </button>
                    )}
                    <button
                        onClick={() => {
                            if (activeTab === 'house') {
                                setActiveTab('expenses');
                            } else {
                                setActiveTab('house');
                                if (viewMode !== 'month') setViewMode('month');
                            }
                        }}
                        className={`p-2 rounded-full transition-colors ${activeTab === 'house' && viewMode === 'month' ? 'bg-emerald-500 text-white shadow' : 'bg-surface border border-slate-700 text-slate-400 hover:text-white'}`}
                        title="Estadísticas de la Casa"
                    >
                        <Home size={20} />
                    </button>
                    <button
                        onClick={() => {
                            if (activeTab === 'house') {
                                setViewMode('year');
                                setActiveTab('expenses');
                            } else {
                                setViewMode(viewMode === 'year' ? 'month' : 'year');
                            }
                        }}
                        className={`p-2 rounded-full transition-colors ${viewMode === 'year' && activeTab !== 'house' ? 'bg-emerald-500 text-white shadow' : 'bg-surface border border-slate-700 text-slate-400 hover:text-white'}`}
                        title={viewMode === 'year' ? "Ver Mes" : "Ver Año"}
                    >
                        {viewMode === 'year' ? <Calendar size={20} /> : <Grid size={20} />}
                    </button>
                    {!showAdd && viewMode === 'month' && activeTab !== 'house' && (
                        <button
                            onClick={handleOpenAdd}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-full shadow-lg transition-transform active:scale-95"
                        >
                            <Plus size={24} />
                        </button>
                    )}
                </div>
            </header>

            {/* Navigation Header */}
            {activeTab !== 'house' && (
                <div className="flex items-center justify-between bg-surface p-2 rounded-xl border border-slate-700">
                    <button
                        onClick={() => setCurrentMonth(viewMode === 'year' ? subYears(currentMonth, 1) : subMonths(currentMonth, 1))}
                        className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div className="text-center flex flex-col items-center">
                        <button
                            onClick={() => setCurrentMonth(new Date())}
                            className="font-bold capitalize text-lg hover:text-emerald-400 transition-colors flex items-center gap-2"
                        >
                            {viewMode === 'year' ? format(currentMonth, 'yyyy') : format(currentMonth, 'MMMM yyyy', { locale: es })}
                            {!isSameMonth(currentMonth, new Date()) && (
                                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-500/30">
                                    Hoy
                                </span>
                            )}
                        </button>
                        {viewMode === 'month' && (
                            isSettled ? (
                                <span className="text-[10px] text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/30 flex items-center gap-1 justify-center mx-auto w-max mt-1">
                                    <Lock size={10} /> CERRADO
                                </span>
                            ) : (
                                <span className="text-[10px] text-slate-400 font-medium block mt-1">
                                    Total: {totalMonthly.toFixed(0)}€
                                </span>
                            )
                        )}
                    </div>
                    <button
                        onClick={() => setCurrentMonth(viewMode === 'year' ? addYears(currentMonth, 1) : addMonths(currentMonth, 1))}
                        className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            )}

            {/* === YEAR OVERVIEW === */}
            {viewMode === 'year' && (
                <div className="grid grid-cols-3 gap-3 animate-in fade-in zoom-in-95 duration-200">
                    {yearMonths.map(month => {
                        const mTotal = getMonthTotal(month);
                        const isCurrent = isThisMonth(month);
                        const isPassed = isPast(month) && !isCurrent;
                        const isFut = isFuture(month);

                        return (
                            <button
                                key={month.toString()}
                                onClick={() => { setCurrentMonth(month); setViewMode('month'); }}
                                disabled={isFut}
                                className={`
                                    p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all
                                    ${isCurrent ? 'bg-emerald-500/20 border-emerald-500 ring-1 ring-emerald-500' : ''}
                                    ${isPassed ? 'bg-surface border-slate-700 hover:border-emerald-500/50' : ''}
                                    ${isFut ? 'opacity-30 border-slate-800 cursor-not-allowed' : ''}
                                `}
                            >
                                <span className={`text-xs font-bold uppercase ${isCurrent ? 'text-emerald-400' : 'text-slate-500'}`}>
                                    {format(month, 'MMM', { locale: es })}
                                </span>
                                {(!isFut || isCurrent) && (
                                    <span className={`text-sm font-bold ${mTotal > 0 ? 'text-white' : 'text-slate-600'}`}>
                                        {mTotal.toFixed(0)}€
                                    </span>
                                )}
                                {isPassed && mTotal > 0 && <Check size={12} className="text-emerald-500 absolute top-2 right-2 opacity-50" />}
                            </button>
                        )
                    })}
                </div>
            )}

            {/* === MONTH VIEW CONTENT === */}
            {viewMode === 'month' && (
                <>
                    {/* Tabs */}
                    {activeTab !== 'house' && (
                        <div className="flex gap-2 p-1 bg-surface border border-slate-700 rounded-xl">
                            <button
                                onClick={() => setActiveTab('expenses')}
                                className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'expenses' ? 'bg-emerald-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                            >
                                Listado ({monthlyExpenses.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('charts')}
                                className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'charts' ? 'bg-emerald-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                            >
                                Gráficos
                            </button>
                            <button
                                onClick={() => setActiveTab('balances')}
                                className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'balances' ? 'bg-emerald-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                            >
                                Saldos {transactions.length > 0 && <span className="ml-1 w-2 h-2 bg-red-500 rounded-full inline-block"></span>}
                            </button>
                        </div>
                    )}

                    {/* --- ADD/EDIT EXPENSE MODAL --- */}
                    {showAdd && (
                        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4">
                            <form onSubmit={handleSubmit} className="bg-surface w-full max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col shadow-2xl animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-y-auto">
                                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50 rounded-t-2xl">
                                    <h3 className="font-bold text-lg text-emerald-400">
                                        {editingId ? 'Editar Gasto' : 'Nuevo Gasto'}
                                    </h3>
                                    <button type="button" onClick={() => setShowAdd(false)} className="p-2 bg-slate-800 rounded-full"><X size={20} /></button>
                                </div>

                                <div className="p-4 space-y-4 pb-12">
                                    {/* Amount & Title */}
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="block text-xs font-medium text-slate-400 mb-1">Concepto *</label>
                                            <input
                                                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 focus:border-emerald-500 outline-none"
                                                value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Compra" autoFocus required
                                            />
                                        </div>
                                        <div className="w-32">
                                            <label className="block text-xs font-medium text-slate-400 mb-1">Importe *</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-3 text-emerald-500">€</span>
                                                <input
                                                    type="number" step="0.01" min="0.01" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 pl-7 focus:border-emerald-500 outline-none text-right font-bold"
                                                    value={amount} onChange={e => setAmount(sanitizeAmount(e.target.value))} placeholder="0.00" required
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Category */}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Categoría *</label>
                                        <select
                                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 outline-none focus:border-emerald-500 font-medium transition-colors cursor-pointer"
                                            value={category} onChange={e => setCategory(e.target.value)}
                                            required
                                        >
                                            <option value="" disabled>Selecciona una categoría</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.id}>
                                                    {cat.icon} {cat.name}
                                                </option>
                                            ))}
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

                                    {/* Split Mode Toggle */}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-2">Para quién (Division)</label>
                                        <div className="bg-slate-900 p-1 rounded-xl mb-3 flex text-sm">
                                            <button
                                                type="button"
                                                onClick={() => setSplitMode('equal')}
                                                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-2 transition-colors ${splitMode === 'equal' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                            >
                                                <Divide size={16} /> Partes Iguales
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSplitMode('custom')}
                                                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-2 transition-colors ${splitMode === 'custom' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                            >
                                                <Percent size={16} /> Por Importe
                                            </button>
                                        </div>
                                    </div>

                                    {/* Custom Split Inputs */}
                                    {splitMode === 'custom' && (
                                        <div className="space-y-3">
                                            {householdMembers.map(m => (
                                                <div key={m.id} className="flex items-center gap-2">
                                                    <div className="flex items-center gap-2 w-32">
                                                        <Avatar url={m.photoURL} name={m.displayName} size="xs" />
                                                        <span className="text-sm overflow-hidden text-ellipsis whitespace-nowrap">{m.displayName?.split(' ')[0]}</span>
                                                    </div>
                                                    <div className="relative flex-1">
                                                        <span className="absolute left-3 top-2.5 text-slate-400 text-xs">€</span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={customAmounts[m.id] || ''}
                                                            onChange={(e) => handleCustomAmountChange(m.id, e.target.value)}
                                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 pl-6 text-sm outline-none focus:border-emerald-500"
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Validation Footer */}
                                            <div className={`p-3 rounded-xl text-center text-sm font-bold flex justify-between items-center border ${isValidCustom ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
                                                }`}>
                                                <span>Asignado: {customSum.toFixed(2)}€</span>
                                                <span>Restante: {(Number(amount) - customSum).toFixed(2)}€</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Equal Split Grid (Only if Equal Mode) */}
                                    {splitMode === 'equal' && (
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
                                    )}

                                    <button
                                        type="submit"
                                        disabled={splitMode === 'custom' && !isValidCustom}
                                        className={`w-full font-bold py-3 rounded-xl transition-all shadow-lg ${splitMode === 'custom' && !isValidCustom
                                            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                            : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20'
                                            }`}
                                    >
                                        {editingId ? 'Guardar Cambios' : 'Guardar Gasto'}
                                    </button>

                                    {editingId && (
                                        <button
                                            type="button"
                                            onClick={handleDelete}
                                            className="w-full text-red-500 text-xs font-bold py-3 hover:bg-red-500/10 rounded-xl transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Trash size={14} /> Eliminar Gasto
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>
                    )}

                    {/* === LIST VIEW === */}
                    {activeTab === 'expenses' && (
                        <div className="space-y-4 animate-in slide-in-from-right-4">
                            {/* Individual Summary Row */}
                            {monthlyExpenses.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                    {individualPaid.map(p => (
                                        <div key={p.uid} className="bg-surface border border-slate-700 rounded-xl p-2 px-3 flex items-center gap-2 shrink-0 shadow-sm">
                                            <Avatar url={p.member?.photoURL} name={p.member?.displayName} size="xs" />
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-slate-500 font-bold uppercase leading-none">{p.member?.displayName?.split(' ')[0]}</span>
                                                <span className="text-sm font-bold text-white leading-none mt-1">{p.amount.toFixed(0)}€</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {monthlyExpenses.length === 0 ? (
                                <div className="text-center py-20 opacity-50 space-y-4">
                                    <div className="bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-slate-600">
                                        <Calendar size={40} />
                                    </div>
                                    <p>No hay gastos en {format(currentMonth, 'MMMM', { locale: es })}.</p>
                                </div>
                            ) : (
                                monthlyExpenses.map(exp => {
                                    const payer = householdMembers.find(m => m.id === exp.payerId);
                                    const isSettlement = exp.category === 'settlement';

                                    return (
                                        <div
                                            key={exp.id}
                                            onClick={() => handleEdit(exp)}
                                            className={`p-4 rounded-xl border flex justify-between items-center shadow-sm cursor-pointer active:scale-[0.98] transition-transform ${isSettlement
                                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                                : 'bg-surface border-slate-700 hover:border-slate-500'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-3 rounded-xl ${exp.category === 'groceries' ? 'bg-orange-500/10 text-orange-400' :
                                                    exp.category === 'dining' ? 'bg-blue-500/10 text-blue-400' :
                                                        exp.category === 'transport' ? 'bg-violet-500/10 text-violet-400' :
                                                            exp.category === 'home' ? 'bg-amber-500/10 text-amber-400' :
                                                                exp.category === 'settlement' ? 'bg-emerald-500 text-white' :
                                                                    'bg-slate-700/50 text-slate-300'
                                                    }`}>
                                                    {exp.category === 'settlement' ? <ArrowRightLeft size={16} /> :
                                                        categories.find(c => c.id === exp.category)?.icon || '📦'}
                                                </div>
                                                <div>
                                                    <h4 className={`font-bold text-base ${isSettlement ? 'text-emerald-400' : ''}`}>{exp.title}</h4>
                                                    <div className="text-xs text-slate-400 flex flex-wrap gap-1 items-center mt-1">
                                                        <span>{format(parseISO(exp.date), 'd MMM', { locale: es })}</span>
                                                        <span>•</span>
                                                        <span>Pagó {payer ? payer.displayName?.split(' ')[0] : '???'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`${isSettlement ? 'text-emerald-400' : 'text-slate-200'} font-bold text-lg`}>
                                                {exp.amount.toFixed(2)}€
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}

                    {/* === CHARTS VIEW === */}
                    {activeTab === 'charts' && (
                        <div className="space-y-4 animate-in slide-in-from-bottom-4">
                            {chartData.length === 0 ? (
                                <div className="text-center py-20 opacity-50 space-y-4">
                                    <div className="bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-slate-600">
                                        <PieChartIcon size={40} />
                                    </div>
                                    <p>No hay datos suficientes para gráficos.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Categories Chart */}
                                    <div className="bg-surface p-6 rounded-2xl border border-slate-700 flex flex-col items-center">
                                        <h3 className="font-bold text-lg text-slate-200 w-full mb-4 flex items-center gap-2">
                                            <Grid size={20} className="text-emerald-500" /> Gasto por Categorías
                                        </h3>
                                        <div className="w-full h-64 mb-4">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={chartData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={80}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                    >
                                                        {chartData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0)" />
                                                        ))}
                                                    </Pie>
                                                    <RechartsTooltip
                                                        formatter={(value) => `${value.toFixed(2)}€`}
                                                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                                                        itemStyle={{ color: '#fff' }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>

                                        <div className="w-full space-y-3">
                                            {chartData.map((d, i) => (
                                                <div key={i} className="flex justify-between items-center p-2 rounded-lg hover:bg-slate-800/50 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }}></div>
                                                        <span className="text-xl">{d.icon}</span>
                                                        <span className="text-sm font-medium text-slate-300">{d.name}</span>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-bold text-white">{d.value.toFixed(2)}€</span>
                                                        <span className="text-[10px] text-slate-500">{((d.value / totalMonthly) * 100).toFixed(0)}%</span>
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="border-t border-slate-700 mt-4 pt-2 flex justify-between items-center font-bold text-lg px-2 text-white">
                                                <span>Total Hogar</span>
                                                <span>{totalMonthly.toFixed(2)}€</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Individual Chart */}
                                    <div className="bg-surface p-6 rounded-2xl border border-slate-700 flex flex-col items-center">
                                        <h3 className="font-bold text-lg text-slate-200 w-full mb-4 flex items-center gap-2">
                                            <User size={20} className="text-emerald-500" /> Gasto por Persona
                                        </h3>
                                        <div className="w-full h-64 mb-4">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={individualChartData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={80}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                    >
                                                        {individualChartData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0)" />
                                                        ))}
                                                    </Pie>
                                                    <RechartsTooltip
                                                        formatter={(value) => `${value.toFixed(2)}€`}
                                                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                                                        itemStyle={{ color: '#fff' }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>

                                        <div className="w-full space-y-3">
                                            {individualPaid.filter(p => p.amount > 0).map((p, i) => {
                                                const color = ['#10B981', '#3B82F6', '#F59E0B', '#F97316', '#8B5CF6', '#EC4899'][i % 6];
                                                return (
                                                    <div key={p.uid} className="flex justify-between items-center p-2 rounded-lg hover:bg-slate-800/50 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }}></div>
                                                            <Avatar url={p.member?.photoURL} name={p.member?.displayName} size="xs" />
                                                            <span className="text-sm font-medium text-slate-300">{p.member?.displayName?.split(' ')[0]}</span>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <span className="font-bold text-white">{p.amount.toFixed(2)}€</span>
                                                            <span className="text-[10px] text-slate-500">{((p.amount / totalMonthly) * 100).toFixed(0)}%</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* === HOUSE STATISTICS VIEW === */}
                    {activeTab === 'house' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4">
                            <div className="bg-surface p-6 rounded-2xl border border-slate-700 space-y-6 shadow-xl relative">
                                <div className="flex items-center justify-between gap-4 transition-all">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <h2 className="text-xl font-bold text-slate-200 truncate sm:whitespace-normal">
                                            Estadísticas de la Casa <span className="text-slate-500 font-medium font-mono text-sm">({statsTitle})</span>
                                        </h2>
                                        <div className="h-px flex-1 bg-slate-800 hidden md:block"></div>
                                    </div>
                                    <button
                                        onClick={() => setShowHouseSettings(true)}
                                        className="shrink-0 p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-all border border-slate-700 shadow-lg active:scale-95"
                                        title="Configurar Categorías"
                                    >
                                        <Settings size={20} />
                                    </button>
                                </div>

                                {statsCategories.length === 0 ? (
                                    <div className="text-center py-10 opacity-50 space-y-4">
                                        <div className="bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-slate-600">
                                            <Settings size={32} />
                                        </div>
                                        <p className="text-sm">No has seleccionado categorías para visualizar.<br />Pulsa el icono de engranaje para configurar.</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {statsCategories.map(cat => (
                                                <div key={cat.id} className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 flex items-center gap-4">
                                                    <div className="p-3 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${cat.color}20` }}>
                                                        <span>{cat.icon}</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{cat.name}</p>
                                                        <p className="text-xl font-black text-white">{(yearlyUtilityTotals[cat.id] || 0).toFixed(2)}€</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            <div className="space-y-3">
                                                <h3 className="text-sm font-bold text-slate-400 uppercase flex items-center gap-2">
                                                    <BarChart2 size={16} /> Evolución por Categoría
                                                </h3>
                                                <div className="h-[400px] w-full bg-slate-900/30 p-3 rounded-xl border border-slate-800">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={yearUtilityData} margin={{ top: 10, right: 5, left: -25, bottom: 5 }}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                                            <XAxis dataKey="name" fontSize={11} axisLine={false} tickLine={false} />
                                                            <YAxis fontSize={11} axisLine={false} tickLine={false} />
                                                            <RechartsTooltip
                                                                cursor={{ fill: '#334155', opacity: 0.4 }}
                                                                formatter={(value) => [`${value.toFixed(2)}€`, '']}
                                                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                                                            />
                                                            <Legend
                                                                verticalAlign="bottom"
                                                                height={40}
                                                                iconType="circle"
                                                                wrapperStyle={{ paddingTop: '10px', fontSize: '10px', fontWeight: 'bold' }}
                                                            />
                                                            {statsCategories.map((cat, idx) => (
                                                                <Bar
                                                                    key={cat.id}
                                                                    dataKey={cat.id}
                                                                    name={cat.name}
                                                                    fill={cat.color}
                                                                    radius={[4, 4, 0, 0]}
                                                                />
                                                            ))}
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <h3 className="text-sm font-bold text-slate-400 uppercase flex items-center gap-2">
                                                    <TrendingUp size={16} /> Gasto Total (Periodo)
                                                </h3>
                                                <div className="h-[400px] w-full bg-slate-900/30 p-3 rounded-xl border border-slate-800">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={yearUtilityData}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                                            <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                                                            <YAxis fontSize={10} axisLine={false} tickLine={false} />
                                                            <RechartsTooltip
                                                                cursor={{ fill: '#334155', opacity: 0.4 }}
                                                                formatter={(value) => [`${value.toFixed(2)}€`, '']}
                                                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                                                            />
                                                            <Bar dataKey="absoluteTotal" name="Gasto Real Mensual" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* HOUSE SETTINGS MODAL */}
                            {showHouseSettings && (
                                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                                    <div className="bg-surface w-full max-w-md rounded-2xl flex flex-col shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                                        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50 rounded-t-2xl sticky top-0 z-10">
                                            <h3 className="font-bold text-lg text-emerald-400">Configurar Estadísticas</h3>
                                            <button onClick={() => setShowHouseSettings(false)} className="p-2 bg-slate-800 rounded-full"><X size={20} /></button>
                                        </div>

                                        <div className="p-6 space-y-8">
                                            {/* Period Selection */}
                                            <div className="space-y-4">
                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                    <Calendar size={14} /> Periodo de Visualización
                                                </h4>
                                                <div className="bg-slate-900 p-1 rounded-xl flex">
                                                    <button
                                                        onClick={() => updateHouseStatsPeriod({ mode: 'calendar' })}
                                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${household?.houseStatsPeriod?.mode !== 'custom' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-white'}`}
                                                    >
                                                        Año Natural
                                                    </button>
                                                    <button
                                                        onClick={() => updateHouseStatsPeriod({
                                                            mode: 'custom',
                                                            start: household?.houseStatsPeriod?.start || format(startOfYear(new Date()), 'yyyy-MM'),
                                                            end: household?.houseStatsPeriod?.end || format(endOfYear(new Date()), 'yyyy-MM')
                                                        })}
                                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${household?.houseStatsPeriod?.mode === 'custom' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-white'}`}
                                                    >
                                                        Rango Personalizado
                                                    </button>
                                                </div>

                                                {household?.houseStatsPeriod?.mode === 'custom' && (
                                                    <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Desde</label>
                                                            <input
                                                                type="month"
                                                                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs outline-none focus:border-emerald-500"
                                                                value={household?.houseStatsPeriod?.start || ''}
                                                                onChange={(e) => updateHouseStatsPeriod({ ...household.houseStatsPeriod, start: e.target.value })}
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Hasta</label>
                                                            <input
                                                                type="month"
                                                                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs outline-none focus:border-emerald-500"
                                                                value={household?.houseStatsPeriod?.end || ''}
                                                                onChange={(e) => updateHouseStatsPeriod({ ...household.houseStatsPeriod, end: e.target.value })}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Categories Selection & Management */}
                                            <div className="space-y-4">
                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                    <Grid size={14} /> Gestión de Categorías
                                                </h4>

                                                <div className="space-y-3">
                                                    {categories.filter(c => c.id !== 'settlement').map((cat, index) => {
                                                        const isChecked = statsCategoryIds.includes(cat.id);
                                                        const customColor = household?.houseStatsCategoryColors?.[cat.id] || cat.color;

                                                        return (
                                                            <div key={cat.id} className="bg-slate-900/50 rounded-2xl border border-slate-800 p-3 space-y-3 group transition-all hover:border-slate-700">
                                                                <div className="flex items-center gap-3">
                                                                    {editingCategoryId === cat.id ? (
                                                                        <div className="flex-1 flex gap-2">
                                                                            <input
                                                                                type="text"
                                                                                value={editCatIcon}
                                                                                onChange={(e) => setEditCatIcon(e.target.value)}
                                                                                className="w-10 h-10 text-center bg-slate-800 border border-slate-700 rounded-xl outline-none focus:border-emerald-500 text-lg"
                                                                                maxLength={2}
                                                                            />
                                                                            <input
                                                                                type="text"
                                                                                value={editCatName}
                                                                                onChange={(e) => setEditCatName(e.target.value)}
                                                                                className="flex-1 px-3 bg-slate-800 border border-slate-700 rounded-xl text-sm outline-none focus:border-emerald-500"
                                                                            />
                                                                            <button
                                                                                onClick={() => {
                                                                                    const newCategories = categories.map(c =>
                                                                                        c.id === cat.id ? { ...c, name: editCatName, icon: editCatIcon } : c
                                                                                    );
                                                                                    updateAllExpenseCategories(newCategories);
                                                                                    setEditingCategoryId(null);
                                                                                }}
                                                                                className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
                                                                            >
                                                                                <Check size={18} />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setEditingCategoryId(null)}
                                                                                className="p-2 bg-slate-700 text-slate-400 rounded-xl hover:bg-slate-600"
                                                                            >
                                                                                <X size={18} />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            {/* Stats Visibility Toggle */}
                                                                            <button
                                                                                onClick={() => {
                                                                                    const newList = isChecked
                                                                                        ? statsCategoryIds.filter(id => id !== cat.id)
                                                                                        : [...statsCategoryIds, cat.id];
                                                                                    updateHouseStatsCategories(newList);
                                                                                }}
                                                                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isChecked
                                                                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                                                                    : 'bg-transparent border-slate-700 text-transparent hover:border-slate-500'
                                                                                    }`}
                                                                                title={isChecked ? "Incluida en estadísticas" : "No incluida en estadísticas"}
                                                                            >
                                                                                <Check size={14} strokeWidth={3} />
                                                                            </button>

                                                                            <span className="text-2xl w-8 text-center">{cat.icon}</span>
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="text-sm font-bold text-slate-200 truncate">{cat.name}</div>
                                                                                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                                                                                    {isChecked ? 'En Estadísticas' : 'Solo Gastos'}
                                                                                </div>
                                                                            </div>

                                                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                {/* Move Up */}
                                                                                <button
                                                                                    onClick={() => {
                                                                                        if (index === 0) return;
                                                                                        const newCats = [...categories];
                                                                                        [newCats[index - 1], newCats[index]] = [newCats[index], newCats[index - 1]];
                                                                                        updateAllExpenseCategories(newCats);
                                                                                    }}
                                                                                    disabled={index === 0}
                                                                                    className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg disabled:opacity-0"
                                                                                >
                                                                                    <ChevronUp size={16} />
                                                                                </button>
                                                                                {/* Move Down */}
                                                                                <button
                                                                                    onClick={() => {
                                                                                        const filtered = categories.filter(c => c.id !== 'settlement');
                                                                                        if (index === filtered.length - 1) return;
                                                                                        const newCats = [...categories];
                                                                                        const realIdx = categories.findIndex(c => c.id === cat.id);
                                                                                        const nextIdx = categories.findIndex((c, i) => i > realIdx && c.id !== 'settlement');
                                                                                        if (nextIdx !== -1) {
                                                                                            [newCats[realIdx], newCats[nextIdx]] = [newCats[nextIdx], newCats[realIdx]];
                                                                                            updateAllExpenseCategories(newCats);
                                                                                        }
                                                                                    }}
                                                                                    disabled={index === categories.filter(c => c.id !== 'settlement').length - 1}
                                                                                    className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg disabled:opacity-0"
                                                                                >
                                                                                    <ChevronDown size={16} />
                                                                                </button>

                                                                                {cat.id !== 'other' && cat.id !== 'settlement' ? (
                                                                                    <>
                                                                                        <button
                                                                                            onClick={() => {
                                                                                                setEditingCategoryId(cat.id);
                                                                                                setEditCatName(cat.name);
                                                                                                setEditCatIcon(cat.icon);
                                                                                            }}
                                                                                            className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-slate-800 rounded-lg"
                                                                                            title="Editar"
                                                                                        >
                                                                                            <Edit size={16} />
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => {
                                                                                                const firstConfirm = confirm(`¿Estás seguro de que quieres eliminar la categoría "${cat.name}"?`);
                                                                                                if (firstConfirm) {
                                                                                                    const secondConfirm = confirm(`¡ATENCIÓN! Al borrarla, TODOS los gastos asociados pasarán a la categoría "OTRO". ¿Confirmas que quieres proceder?`);
                                                                                                    if (secondConfirm) {
                                                                                                        deleteExpenseCategory(cat.id);
                                                                                                    }
                                                                                                }
                                                                                            }}
                                                                                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg"
                                                                                            title="Eliminar"
                                                                                        >
                                                                                            <Trash size={16} />
                                                                                        </button>
                                                                                    </>
                                                                                ) : (
                                                                                    <div className="p-1.5 text-slate-700" title="Categoría del sistema bloqueada">
                                                                                        <Lock size={14} />
                                                                                    </div>
                                                                                )}
                                                                            </div>

                                                                            <div className="relative group/color">
                                                                                <input
                                                                                    type="color"
                                                                                    value={customColor}
                                                                                    onChange={(e) => {
                                                                                        updateHouseStatsCategoryColor(cat.id, e.target.value);
                                                                                        // Also update master color in categories list
                                                                                        const newCategories = categories.map(c =>
                                                                                            c.id === cat.id ? { ...c, color: e.target.value } : c
                                                                                        );
                                                                                        updateAllExpenseCategories(newCategories);
                                                                                    }}
                                                                                    className="w-8 h-8 rounded-lg cursor-pointer border-2 border-slate-700 hover:border-emerald-500 transition-colors"
                                                                                />
                                                                                <Palette size={10} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-white opacity-0 group-hover/color:opacity-100" />
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}

                                                    {/* Add New Quick Form */}
                                                    <div className="bg-slate-900 border border-dashed border-slate-700 rounded-2xl p-3 flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={newCatIcon}
                                                            onChange={(e) => setNewCatIcon(e.target.value)}
                                                            className="w-10 h-10 text-center bg-slate-800 border border-slate-700 rounded-xl outline-none focus:border-emerald-500 text-lg"
                                                            placeholder="📦"
                                                            maxLength={2}
                                                        />
                                                        <input
                                                            type="text"
                                                            value={newCatName}
                                                            onChange={(e) => setNewCatName(e.target.value)}
                                                            className="flex-1 px-3 bg-slate-800 border border-slate-700 rounded-xl text-sm outline-none focus:border-emerald-500"
                                                            placeholder="Nueva categoría..."
                                                        />
                                                        <button
                                                            onClick={() => {
                                                                if (!newCatName.trim()) return;
                                                                const newCat = {
                                                                    id: `custom_${Date.now()}`,
                                                                    name: newCatName.trim(),
                                                                    icon: newCatIcon || '📦',
                                                                    color: '#64748B'
                                                                };
                                                                updateAllExpenseCategories([...categories, newCat]);
                                                                // Also add to stats by default
                                                                updateHouseStatsCategories([...statsCategoryIds, newCat.id]);
                                                                setNewCatName("");
                                                                setNewCatIcon("📦");
                                                            }}
                                                            disabled={!newCatName.trim()}
                                                            className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                                                        >
                                                            <Plus size={24} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-4 bg-slate-900/50 rounded-b-2xl sticky bottom-0 border-t border-slate-700">
                                            <button
                                                onClick={() => setShowHouseSettings(false)}
                                                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-emerald-500/20"
                                            >
                                                Confirmar Cambios
                                            </button>
                                        </div>
                                    </div>
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
                                    <TrendingUp className="text-emerald-500" /> Balance Mensual
                                </h3>

                                {isSettled && (
                                    <div className="bg-green-500/20 text-green-400 p-3 rounded-xl text-sm font-bold flex items-center gap-2">
                                        <Check size={16} /> Este mes está liquidado.
                                    </div>
                                )}

                                <div className="space-y-4">
                                    {balances.map(b => {
                                        const isPositive = b.amount >= 0.01;
                                        const isNegative = b.amount <= -0.01;
                                        const isZero = !isPositive && !isNegative;
                                        const barWidth = Math.min(Math.abs(b.amount) * 3, 150); // Visual scaling

                                        return (
                                            <div key={b.uid} className="flex items-center gap-3">
                                                <Avatar url={b.member?.photoURL} name={b.member?.displayName} />
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-end mb-1">
                                                        <span className="font-medium text-sm">{b.member?.displayName?.split(' ')[0]}</span>
                                                        <span className={`font-bold ${isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-slate-500'}`}>
                                                            {isPositive ? '+' : ''}{b.amount.toFixed(2)}€
                                                        </span>
                                                    </div>
                                                    {!isZero && (
                                                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
                                                            {isPositive ? (
                                                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${barWidth}px` }}></div>
                                                            ) : (
                                                                <div className="h-full bg-red-500 rounded-full ml-auto" style={{ width: `${barWidth}px` }}></div>
                                                            )}
                                                        </div>
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
                                    <div className="p-4 rounded-xl border border-dashed border-slate-700 text-center text-slate-500 text-sm">
                                        Todo cuadrado 👌
                                    </div>
                                ) : (
                                    transactions.map((t, idx) => (
                                        <div key={idx} className="bg-surface p-4 rounded-xl border border-slate-700 flex flex-col gap-3 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center gap-1">
                                                        <Avatar url={t.from?.photoURL} name={t.from?.displayName} size="xs" />
                                                        <span className="font-bold text-slate-200 text-sm">{t.from?.displayName?.split(' ')[0]}</span>
                                                    </div>
                                                    <span className="text-xs text-slate-500">paga a</span>
                                                    <div className="flex items-center gap-1">
                                                        <Avatar url={t.to?.photoURL} name={t.to?.displayName} size="xs" />
                                                        <span className="font-bold text-slate-200 text-sm">{t.to?.displayName?.split(' ')[0]}</span>
                                                    </div>
                                                </div>
                                                <div className="text-xl font-bold text-white">{t.amount.toFixed(2)}€</div>
                                            </div>
                                            <button
                                                onClick={() => handleSettleUp(t.from, t.to, t.amount)}
                                                className="w-full py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg text-xs font-bold transition-colors"
                                            >
                                                MARCAR COMO PAGADO
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

        </div>
    );
}

const Avatar = ({ url, name, size = 'md' }) => {
    const s = size === 'xs' ? 'w-6 h-6' : 'w-10 h-10';
    if (!url) return <div className={`${s} bg-slate-700 rounded-full flex items-center justify-center`}><User size={size === 'xs' ? 14 : 20} /></div>
    return <img src={url} alt={name} className={`${s} rounded-full border border-slate-600`} />
}
