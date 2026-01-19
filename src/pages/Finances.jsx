import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { db, doc, getDoc, setDoc, onSnapshot, updateDoc, collection, addDoc, query, where, orderBy, getDocs, deleteDoc, runTransaction } from '../lib/firebase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUp, PieChart as PieIcon, ArrowUpCircle, ArrowDownCircle, DollarSign, Plus, Trash2, Edit2, Save, X, ChevronLeft, ChevronRight, BarChart2, Settings, Wallet } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

export default function Finances() {
    const { user } = useStore();
    const [year, setYear] = useState(new Date().getFullYear());
    const [view, setView] = useState('budget'); // 'budget' | 'investments'

    // Data State
    const [financeData, setFinanceData] = useState(null); // { incomeCategories: [], expenseCategories: [], monthly: { 0: { incomes: {}, expenses: {} }, ... } }
    const [stocks, setStocks] = useState([]);
    const [dividends, setDividends] = useState([]);
    const [savings, setSavings] = useState([]);

    // UI State
    const [isLoading, setIsLoading] = useState(true);
    const [showConfig, setShowConfig] = useState(false); // Modal to configure categories
    const [showControls, setShowControls] = useState(false); // Toggle for top controls

    // Fetch Data
    useEffect(() => {
        if (!user) return;

        setIsLoading(true);
        // We will store finances in a subcollection 'finances' under user, document ID is the year.
        // Actually, user wanted separation by years.
        // Structure: users/{uid}/finance_years/{year} -> Contains monthly data and categories snapshot?
        // Or store categories globally for the user users/{uid}/finance_settings

        // Let's use a single doc for the year for simplicity of the table view
        const yearDocRef = doc(db, 'users', user.uid, 'finance_years', String(year));

        const unsubscribe = onSnapshot(yearDocRef, (snap) => {
            if (snap.exists()) {
                setFinanceData(snap.data());
            } else {
                // Initialize default structure if new year
                setFinanceData({
                    incomeCategories: ['Salario', 'Ingresos por intereses'],
                    expenseCategories: ['Alquiler/Hipoteca', 'Comida'],
                    monthly: {} // index 0-11
                });
            }
            setIsLoading(false);
        });

        // Fetch Investments (Global or Yearly? Usually tax is yearly. Let's filter by year in memory or query)
        // Let's store investments in a subcollection 'investments'
        const stockQ = query(
            collection(db, 'users', user.uid, 'investments'),
            where('type', '==', 'sale'),
            where('year', '==', year) // We should save 'year' field on records for easy querying
        );

        // Realtime investments?
        // For now let's just use onSnapshot for consistency
        const unsubStocks = onSnapshot(stockQ, (snap) => {
            setStocks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const dividendQ = query(
            collection(db, 'users', user.uid, 'investments'),
            where('type', '==', 'dividend'),
            where('year', '==', year)
        );
        const unsubDividends = onSnapshot(dividendQ, (snap) => {
            setDividends(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        // Fetch Savings (All time history for balance)
        // Fetch Savings (All time history for balance)
        const savingsQ = query(
            collection(db, 'users', user.uid, 'investments'),
            where('type', '==', 'savings')
        );
        const unsubSavings = onSnapshot(savingsQ, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Sort client-side to avoid index requirement
            data.sort((a, b) => new Date(b.date) - new Date(a.date));
            setSavings(data);
        });

        return () => {
            unsubscribe();
            unsubStocks();
            unsubDividends();
            unsubSavings();
        }
    }, [user, year]);

    // Derived Logic for Charts
    const yearlyTotals = useMemo(() => {
        if (!financeData) return { income: 0, expense: 0, savings: 0 };

        let totalIncome = 0;
        let totalExpense = 0;

        Object.values(financeData.monthly || {}).forEach(monthData => {
            Object.values(monthData.incomes || {}).forEach(v => totalIncome += Number(v));
            Object.values(monthData.expenses || {}).forEach(v => totalExpense += Number(v));
        });

        return {
            income: totalIncome,
            expense: totalExpense,
            savings: totalIncome - totalExpense
        };
    }, [financeData]);

    const pieData = [
        { name: 'Ingresos', value: yearlyTotals.income, color: '#3B82F6' },
        { name: 'Gastos', value: yearlyTotals.expense, color: '#EF4444' },
    ];

    // --- HANDLERS ---

    // Save cell update
    const handleCellUpdate = async (monthIndex, type, category, value) => {
        if (!financeData) return;

        // Use deep clone to avoid mutating state directly and to ensure clean object for Firestore
        const newData = structuredClone(financeData);

        if (!newData.monthly) newData.monthly = {};
        if (!newData.monthly[monthIndex]) newData.monthly[monthIndex] = { incomes: {}, expenses: {} };

        const targetGroup = type === 'income' ? 'incomes' : 'expenses';
        if (!newData.monthly[monthIndex][targetGroup]) newData.monthly[monthIndex][targetGroup] = {};

        newData.monthly[monthIndex][targetGroup][category] = Number(value);

        // Optimistic update (optional, but good for UI responsiveness if snapshot laggy)
        setFinanceData(newData);

        await setDoc(doc(db, 'users', user.uid, 'finance_years', String(year)), newData, { merge: true });
    };

    // Add category
    const handleAddCategory = async (type, name) => {
        if (!name.trim()) return;
        const field = type === 'income' ? 'incomeCategories' : 'expenseCategories';
        const current = financeData?.[field] || [];
        if (current.includes(name)) return;

        await setDoc(doc(db, 'users', user.uid, 'finance_years', String(year)), {
            ...financeData,
            [field]: [...current, name]
        });
    };

    // Rename Category
    const handleRenameCategory = async (type, oldName, newName) => {
        if (!newName.trim() || oldName === newName) return;

        const field = type === 'income' ? 'incomeCategories' : 'expenseCategories';
        const groupKey = type === 'income' ? 'incomes' : 'expenses';

        const newData = structuredClone(financeData);

        // 1. Update List
        const list = newData[field] || [];
        const idx = list.indexOf(oldName);
        if (idx !== -1) list[idx] = newName;
        newData[field] = list;

        // 2. Update all monthly data
        if (newData.monthly) {
            Object.values(newData.monthly).forEach(month => {
                if (month[groupKey] && month[groupKey][oldName] !== undefined) {
                    month[groupKey][newName] = month[groupKey][oldName];
                    delete month[groupKey][oldName];
                }
            });
        }

        setFinanceData(newData);
        await setDoc(doc(db, 'users', user.uid, 'finance_years', String(year)), newData, { merge: true });
    };

    // Delete Category
    const handleDeleteCategory = async (type, name) => {
        if (!confirm(`¿Eliminar la categoría "${name}" y todos sus datos asociados?`)) return;

        const field = type === 'income' ? 'incomeCategories' : 'expenseCategories';
        const groupKey = type === 'income' ? 'incomes' : 'expenses';

        const newData = structuredClone(financeData);

        // 1. Remove from List
        newData[field] = (newData[field] || []).filter(c => c !== name);

        // 2. Remove from all monthly data
        if (newData.monthly) {
            Object.values(newData.monthly).forEach(month => {
                if (month[groupKey]) {
                    delete month[groupKey][name];
                }
            });
        }

        setFinanceData(newData);
        await setDoc(doc(db, 'users', user.uid, 'finance_years', String(year)), newData, { merge: true });
    };

    return (
        <div className="p-4 pb-24 space-y-6 animate-in fade-in relative">
            {/* HEADER */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent flex items-center gap-2">
                        <TrendingUp /> Finanzas Personales
                    </h1>
                    <button
                        onClick={() => setShowControls(!showControls)}
                        className={`p-2 rounded-lg transition-colors ${showControls ? 'bg-amber-500 text-black' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
                        title="Configuración y Año"
                    >
                        <Settings size={20} />
                    </button>
                    {/* Showing year always might be nice, or hiding it as well? User said 'Gestioanr categorias y el año'. Ill hide year too. */}
                    {!showControls && <span className="text-slate-500 text-sm font-bold bg-slate-900 px-2 py-1 rounded border border-slate-800">{year}</span>}
                </div>

                <div className={`overflow-hidden transition-all duration-300 ${showControls ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="flex items-center gap-2">
                        {view === 'budget' && (
                            <button
                                onClick={() => setShowConfig(true)}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl flex items-center gap-2 text-sm font-bold border border-slate-700"
                            >
                                <Edit2 size={16} /> Gestionar Categorías
                            </button>
                        )}
                        <div className="flex items-center gap-4 bg-surface p-1 rounded-xl border border-slate-700">
                            <button onClick={() => setYear(y => y - 1)} className="p-2 hover:bg-slate-700 rounded-lg"><ChevronLeft size={20} /></button>
                            <span className="font-bold text-xl min-w-[3ch] text-center">{year}</span>
                            <button onClick={() => setYear(y => y + 1)} className="p-2 hover:bg-slate-700 rounded-lg"><ChevronRight size={20} /></button>
                        </div>
                    </div>
                </div>
            </div>

            {/* TABS */}
            <div className="flex gap-2 border-b border-slate-700">
                <button
                    onClick={() => setView('budget')}
                    className={`pb-2 px-4 font-bold text-sm transition-colors border-b-2 ${view === 'budget' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400'}`}
                >
                    Presupuesto
                </button>
                <button
                    onClick={() => setView('investments')}
                    className={`pb-2 px-4 font-bold text-sm transition-colors border-b-2 ${view === 'investments' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400'}`}
                >
                    Inversiones
                </button>
                <button
                    onClick={() => setView('accounts')}
                    className={`pb-2 px-4 font-bold text-sm transition-colors border-b-2 ${view === 'accounts' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400'}`}
                >
                    Cuentas
                </button>
            </div>

            {/* VIEWS */}
            {view === 'budget' && (
                <BudgetView
                    year={year}
                    data={financeData}
                    onUpdate={handleCellUpdate}
                    pieData={pieData}
                    totals={yearlyTotals}
                />
            )}

            {view === 'investments' && (
                <InvestmentsView
                    year={year}
                    stocks={stocks}
                    dividends={dividends}
                    userId={user.uid}
                />
            )}

            {view === 'accounts' && (
                <AccountsView
                    year={year}
                    transactions={savings}
                    userId={user.uid}
                />
            )}

            {/* CATEGORY MANAGER MODAL */}
            {showConfig && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95">
                        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900">
                            <h2 className="font-bold text-lg flex items-center gap-2">
                                <Edit2 size={18} className="text-amber-500" /> Gestionar Categorías
                            </h2>
                            <button onClick={() => setShowConfig(false)} className="bg-slate-800 p-2 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-8">
                            {/* INCOMES */}
                            <div>
                                <h3 className="text-emerald-400 font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
                                    <ArrowUpCircle size={16} /> Ingresos
                                </h3>
                                <CategoryList
                                    items={financeData?.incomeCategories || []}
                                    onAdd={(name) => handleAddCategory('income', name)}
                                    onRename={(old, newName) => handleRenameCategory('income', old, newName)}
                                    onDelete={(name) => handleDeleteCategory('income', name)}
                                    colorClass="text-emerald-300"
                                />
                            </div>

                            {/* EXPENSES */}
                            <div>
                                <h3 className="text-red-400 font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
                                    <ArrowDownCircle size={16} /> Gastos
                                </h3>
                                <CategoryList
                                    items={financeData?.expenseCategories || []}
                                    onAdd={(name) => handleAddCategory('expense', name)}
                                    onRename={(old, newName) => handleRenameCategory('expense', old, newName)}
                                    onDelete={(name) => handleDeleteCategory('expense', name)}
                                    colorClass="text-red-300"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const CategoryList = ({ items, onAdd, onRename, onDelete, colorClass }) => {
    const [newName, setNewName] = useState("");
    const [editing, setEditing] = useState(null); // name being edited
    const [editVal, setEditVal] = useState("");

    const handleAdd = (e) => {
        e.preventDefault();
        onAdd(newName);
        setNewName("");
    }

    const startEdit = (name) => {
        setEditing(name);
        setEditVal(name);
    }

    const saveEdit = (oldName) => {
        onRename(oldName, editVal);
        setEditing(null);
    }

    return (
        <div className="space-y-3">
            <form onSubmit={handleAdd} className="flex gap-2 mb-4">
                <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Nueva categoría..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm outline-none focus:border-slate-500"
                />
                <button disabled={!newName.trim()} className="bg-slate-800 disabled:opacity-50 hover:bg-slate-700 text-white px-4 rounded-lg font-bold text-sm">
                    Añadir
                </button>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {items.map(item => (
                    <div key={item} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-800 group hover:border-slate-600 transition-colors">
                        {editing === item ? (
                            <div className="flex items-center gap-2 w-full">
                                <input
                                    value={editVal}
                                    onChange={e => setEditVal(e.target.value)}
                                    className="flex-1 bg-black/20 rounded p-1 text-sm outline-none"
                                    autoFocus
                                />
                                <button onClick={() => saveEdit(item)} className="text-green-400"><Save size={16} /></button>
                                <button onClick={() => setEditing(null)} className="text-slate-500"><X size={16} /></button>
                            </div>
                        ) : (
                            <>
                                <span className={`font-medium text-sm ${colorClass}`}>{item}</span>
                                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => startEdit(item)} className="p-1.5 text-slate-500 hover:text-white rounded hover:bg-slate-700"><Edit2 size={14} /></button>
                                    <button onClick={() => onDelete(item)} className="p-1.5 text-slate-500 hover:text-red-400 rounded hover:bg-slate-700"><Trash2 size={14} /></button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

// --- SUBCOMPONENTS ---

const BudgetView = ({ year, data, onUpdate, pieData, totals }) => {
    const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

    // Calculate monthly totals
    const getMonthTotals = (monthIndex) => {
        const mData = data?.monthly?.[monthIndex] || {};
        const inc = Object.values(mData.incomes || {}).reduce((a, b) => a + Number(b), 0);
        const exp = Object.values(mData.expenses || {}).reduce((a, b) => a + Number(b), 0);
        return { inc, exp, save: inc - exp };
    };

    return (
        <div className="space-y-8">
            {/* 1. Yearly Summary Table */}
            <div className="bg-surface rounded-2xl border border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-900 text-slate-400">
                        <tr>
                            <th className="p-3 text-left">Resumen Anual</th>
                            {months.map(m => <th key={m} className="p-2 text-center text-xs">{m}</th>)}
                            <th className="p-3 text-right bg-slate-800 text-white">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        <tr className="bg-emerald-900/10">
                            <td className="p-3 font-bold text-emerald-400">Ingresos</td>
                            {months.map((_, i) => (
                                <td key={i} className="p-2 text-center text-emerald-400/80">
                                    {getMonthTotals(i).inc > 0 ? getMonthTotals(i).inc.toFixed(0) : '-'}
                                </td>
                            ))}
                            <td className="p-3 text-right font-bold text-emerald-400">{totals.income.toFixed(2)}€</td>
                        </tr>
                        <tr className="bg-red-900/10">
                            <td className="p-3 font-bold text-red-400">Gastos</td>
                            {months.map((_, i) => (
                                <td key={i} className="p-2 text-center text-red-400/80">
                                    {getMonthTotals(i).exp > 0 ? getMonthTotals(i).exp.toFixed(0) : '-'}
                                </td>
                            ))}
                            <td className="p-3 text-right font-bold text-red-400">{totals.expense.toFixed(2)}€</td>
                        </tr>
                        <tr className="bg-slate-800 font-bold">
                            <td className="p-3 text-slate-200">Ahorro</td>
                            {months.map((_, i) => {
                                const sav = getMonthTotals(i).save;
                                return (
                                    <td key={i} className={`p-2 text-center ${sav >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                                        {sav !== 0 ? sav.toFixed(0) : '-'}
                                    </td>
                                )
                            })}
                            <td className="p-3 text-right text-blue-400">{totals.savings.toFixed(2)}€</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Detailed Tables */}

            {/* INCOMES */}
            <div className="bg-surface rounded-2xl border border-slate-700 overflow-x-auto">
                <div className="p-4 bg-slate-900 border-b border-slate-700 flex justify-between items-center">
                    <h3 className="font-bold text-emerald-400 flex items-center gap-2"><ArrowUpCircle size={18} /> Fuente de Ingresos</h3>
                </div>
                <table className="w-full text-sm whitespace-nowrap">
                    <thead className="bg-slate-900/50 text-slate-400">
                        <tr>
                            <th className="p-3 text-left w-48 sticky left-0 bg-slate-900 z-10 border-r border-slate-700">Categoría</th>
                            {months.map(m => <th key={m} className="p-2 text-center w-24">{m}</th>)}
                            <th className="p-3 text-right bg-slate-900">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {data?.incomeCategories?.map(cat => {
                            let rowTotal = 0;
                            const isLocked = cat === 'Acciones' || cat === 'Dividendos';
                            return (
                                <tr key={cat} className="hover:bg-slate-800/30">
                                    <td className="p-3 font-medium sticky left-0 bg-surface border-r border-slate-700">
                                        {cat}
                                        {isLocked && <span className="text-xs text-slate-500 ml-1">(Auto)</span>}
                                    </td>
                                    {months.map((_, i) => {
                                        const val = data?.monthly?.[i]?.incomes?.[cat] || 0;
                                        rowTotal += Number(val);
                                        return (
                                            <td key={i} className="p-0">
                                                <input
                                                    type="number"
                                                    disabled={isLocked}
                                                    className={`w-full h-full bg-transparent text-center p-2 outline-none transition-colors ${isLocked ? 'text-slate-500 cursor-not-allowed' : 'focus:bg-slate-800 text-slate-300'}`}
                                                    value={val || ''}
                                                    placeholder="-"
                                                    onChange={(e) => onUpdate(i, 'income', cat, e.target.value)}
                                                />
                                            </td>
                                        )
                                    })}
                                    <td className="p-3 text-right font-bold text-emerald-400">{rowTotal.toFixed(2)}€</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* EXPENSES */}
            <div className="bg-surface rounded-2xl border border-slate-700 overflow-x-auto">
                <div className="p-4 bg-slate-900 border-b border-slate-700 flex justify-between items-center">
                    <h3 className="font-bold text-red-400 flex items-center gap-2"><ArrowDownCircle size={18} /> Descripción de Gastos</h3>
                </div>
                <table className="w-full text-sm whitespace-nowrap">
                    <thead className="bg-slate-900/50 text-slate-400">
                        <tr>
                            <th className="p-3 text-left w-48 sticky left-0 bg-slate-900 z-10 border-r border-slate-700">Categoría</th>
                            {months.map(m => <th key={m} className="p-2 text-center w-24">{m}</th>)}
                            <th className="p-3 text-right bg-slate-900">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {data?.expenseCategories?.map(cat => {
                            let rowTotal = 0;
                            return (
                                <tr key={cat} className="hover:bg-slate-800/30">
                                    <td className="p-3 font-medium sticky left-0 bg-surface border-r border-slate-700">{cat}</td>
                                    {months.map((_, i) => {
                                        const val = data?.monthly?.[i]?.expenses?.[cat] || 0;
                                        rowTotal += Number(val);
                                        return (
                                            <td key={i} className="p-0">
                                                <input
                                                    type="number"
                                                    className="w-full h-full bg-transparent text-center p-2 outline-none focus:bg-slate-800 transition-colors text-slate-300"
                                                    value={val || ''}
                                                    placeholder="-"
                                                    onChange={(e) => onUpdate(i, 'expense', cat, e.target.value)}
                                                />
                                            </td>
                                        )
                                    })}
                                    <td className="p-3 text-right font-bold text-red-400">{rowTotal.toFixed(2)}€</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Chart (Moved Bottom) */}
            <div className="bg-surface p-4 rounded-2xl border border-slate-700 flex flex-col items-center justify-center min-h-[300px]">
                <h3 className="text-lg font-bold mb-4">Presupuesto Anual</h3>
                <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                        <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <RechartsTooltip
                            formatter={(val) => `${val.toFixed(2)}€`}
                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                        />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
                <div className="text-center mt-2">
                    <span className="text-2xl font-bold">{totals.savings.toFixed(2)}€</span>
                    <p className="text-xs text-slate-400">Ahorro Neto</p>
                </div>
            </div>
        </div>
    )
}

const InvestmentsView = ({ year, stocks, dividends, userId }) => {
    const [invTab, setInvTab] = useState('stocks'); // 'stocks' | 'dividends'
    const [isAdding, setIsAdding] = useState(false);

    // New Stock Form
    const [sDate, setSDate] = useState(new Date().toISOString().split('T')[0]);
    const [sCompany, setSCompany] = useState("");
    const [sBuy, setSBuy] = useState("");
    const [sSell, setSSell] = useState("");

    const handleAddStock = async (e) => {
        e.preventDefault();
        const profit = Number(sSell) - Number(sBuy);
        const roi = (profit / Number(sBuy)) * 100;

        // 1. Add Investment Record
        await addDoc(collection(db, 'users', userId, 'investments'), {
            type: 'sale',
            date: sDate,
            year: year,
            company: sCompany,
            buyAmount: Number(sBuy),
            sellAmount: Number(sSell),
            profit,
            roi,
            createdAt: new Date().toISOString()
        });

        // 2. Automatically update Monthly Budget
        try {
            const saleMonth = new Date(sDate).getMonth(); // 0-11
            const financeDocRef = doc(db, 'users', userId, 'finance_years', String(year));

            await runTransaction(db, async (transaction) => {
                const sfDoc = await transaction.get(financeDocRef);
                if (!sfDoc.exists()) return; // Should exist if we are viewing it

                const data = sfDoc.data();

                // Ensure 'Acciones' is in incomeCategories
                let incomeCategories = data.incomeCategories || [];
                if (!incomeCategories.includes("Acciones")) {
                    incomeCategories.push("Acciones");
                }

                // Prepare nested path safely
                const monthly = data.monthly || {};
                if (!monthly[saleMonth]) monthly[saleMonth] = { incomes: {}, expenses: {} };
                if (!monthly[saleMonth].incomes) monthly[saleMonth].incomes = {};

                // Add profit to existing value (accummulate)
                const currentVal = Number(monthly[saleMonth].incomes["Acciones"] || 0);
                monthly[saleMonth].incomes["Acciones"] = currentVal + profit;

                transaction.update(financeDocRef, {
                    incomeCategories,
                    monthly
                });
            });
        } catch (error) {
            console.error("Error updating budget with stock profit:", error);
        }

        setIsAdding(false);
        setSCompany(""); setSBuy(""); setSSell("");
    };

    // Form for Dividends
    const [dDate, setDDate] = useState(new Date().toISOString().split('T')[0]);
    const [dCompany, setDCompany] = useState("");
    const [dAmount, setDAmount] = useState("");

    const handleAddDividend = async (e) => {
        e.preventDefault();
        const divAmount = Number(dAmount);

        // 1. Add Investment Record
        await addDoc(collection(db, 'users', userId, 'investments'), {
            type: 'dividend',
            date: dDate,
            year: year,
            company: dCompany,
            amount: divAmount,
            createdAt: new Date().toISOString()
        });

        // 2. Automatically update Monthly Budget
        try {
            const divMonth = new Date(dDate).getMonth(); // 0-11
            const financeDocRef = doc(db, 'users', userId, 'finance_years', String(year));

            await runTransaction(db, async (transaction) => {
                const sfDoc = await transaction.get(financeDocRef);
                if (!sfDoc.exists()) return;

                const data = sfDoc.data();

                // Ensure 'Dividendos' is in incomeCategories
                let incomeCategories = data.incomeCategories || [];
                if (!incomeCategories.includes("Dividendos")) {
                    incomeCategories.push("Dividendos");
                }

                // Prepare nested path safely
                const monthly = data.monthly || {};
                if (!monthly[divMonth]) monthly[divMonth] = { incomes: {}, expenses: {} };
                if (!monthly[divMonth].incomes) monthly[divMonth].incomes = {};

                // Add dividend to existing value
                const currentVal = Number(monthly[divMonth].incomes["Dividendos"] || 0);
                monthly[divMonth].incomes["Dividendos"] = currentVal + divAmount;

                transaction.update(financeDocRef, {
                    incomeCategories,
                    monthly
                });
            });
        } catch (error) {
            console.error("Error updating budget with dividend:", error);
        }

        setIsAdding(false);
        setDCompany(""); setDAmount("");
    }

    const handleDelete = async (id) => {
        if (!confirm('¿Estás seguro de que quieres eliminar este registro?')) return;
        if (!confirm('⚠️ Confirmación final: ¿Realmente deseas eliminarlo? Esta acción no se restaurará automáticamente en el presupuesto.')) return;

        await deleteDoc(doc(db, 'users', userId, 'investments', id));
    }

    const totalStockProfit = stocks.reduce((acc, curr) => acc + curr.profit, 0);
    const totalInvested = stocks.reduce((acc, curr) => acc + curr.buyAmount, 0);
    const totalROI = totalInvested > 0 ? (totalStockProfit / totalInvested) * 100 : 0;

    const totalDivProfit = dividends.reduce((acc, curr) => acc + curr.amount, 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
                <div onClick={() => setInvTab('stocks')} className={`flex-1 p-4 rounded-xl border cursor-pointer transition-all ${invTab === 'stocks' ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500' : 'bg-surface border-slate-700 hover:border-slate-500'}`}>
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="font-medium text-slate-400 text-sm">Plusvalías Ventas</h3>
                            <p className={`text-2xl font-bold ${totalStockProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{totalStockProfit.toFixed(2)}€</p>
                        </div>
                        <div className="text-right">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${totalROI >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {totalROI >= 0 ? '+' : ''}{totalROI.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-700/50 flex justify-between text-xs">
                        <span className="text-slate-500">Total Invertido:</span>
                        <span className="text-slate-300 font-mono">{totalInvested.toFixed(2)}€</span>
                    </div>
                </div>
                <div onClick={() => setInvTab('dividends')} className={`flex-1 p-4 rounded-xl border cursor-pointer transition-all ${invTab === 'dividends' ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500' : 'bg-surface border-slate-700 hover:border-slate-500'}`}>
                    <h3 className="font-medium text-slate-400 text-sm">Total Dividendos</h3>
                    <p className="text-2xl font-bold text-green-400">{totalDivProfit.toFixed(2)}€</p>
                </div>
            </div>

            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-200">{invTab === 'stocks' ? 'Control de Ventas Acciones' : 'Registro de Dividendos'}</h2>
                <button onClick={() => setIsAdding(!isAdding)} className="bg-amber-500 text-black px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                    {isAdding ? <X size={16} /> : <Plus size={16} />}
                    {isAdding ? 'Cancelar' : 'Añadir Operación'}
                </button>
            </div>

            {/* ADD FORM */}
            {isAdding && (
                <div className="bg-slate-900/50 p-4 rounded-xl border border-dashed border-slate-700 animate-in slide-in-from-top-4">
                    {invTab === 'stocks' ? (
                        <form onSubmit={handleAddStock} className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                            <div><label className="text-xs text-slate-400">Fecha</label><input type="date" required value={sDate} onChange={e => setSDate(e.target.value)} className="w-full bg-slate-800 border-slate-700 rounded-lg p-2 text-sm" /></div>
                            <div><label className="text-xs text-slate-400">Empresa</label><input required value={sCompany} onChange={e => setSCompany(e.target.value)} placeholder="Ticker" className="w-full bg-slate-800 border-slate-700 rounded-lg p-2 text-sm" /></div>
                            <div><label className="text-xs text-slate-400">Compra (€)</label><input type="number" step="0.01" required value={sBuy} onChange={e => setSBuy(e.target.value)} className="w-full bg-slate-800 border-slate-700 rounded-lg p-2 text-sm" /></div>
                            <div><label className="text-xs text-slate-400">Venta (€)</label><input type="number" step="0.01" required value={sSell} onChange={e => setSSell(e.target.value)} className="w-full bg-slate-800 border-slate-700 rounded-lg p-2 text-sm" /></div>
                            <button className="bg-emerald-500 text-white p-2 rounded-lg font-bold">Guardar</button>
                        </form>
                    ) : (
                        <form onSubmit={handleAddDividend} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                            <div><label className="text-xs text-slate-400">Fecha</label><input type="date" required value={dDate} onChange={e => setDDate(e.target.value)} className="w-full bg-slate-800 border-slate-700 rounded-lg p-2 text-sm" /></div>
                            <div><label className="text-xs text-slate-400">Empresa</label><input required value={dCompany} onChange={e => setDCompany(e.target.value)} placeholder="Ticker" className="w-full bg-slate-800 border-slate-700 rounded-lg p-2 text-sm" /></div>
                            <div><label className="text-xs text-slate-400">Importe Neto (€)</label><input type="number" step="0.01" required value={dAmount} onChange={e => setDAmount(e.target.value)} className="w-full bg-slate-800 border-slate-700 rounded-lg p-2 text-sm" /></div>
                            <button className="bg-emerald-500 text-white p-2 rounded-lg font-bold">Guardar</button>
                        </form>
                    )}
                </div>
            )}

            {/* TABLES */}
            <div className="bg-surface rounded-xl border border-slate-700 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-slate-900 text-slate-400">
                        <tr>
                            <th className="p-3 text-left">Fecha</th>
                            <th className="p-3 text-left">Empresa</th>
                            {invTab === 'stocks' && <th className="p-3 text-right">Inversión</th>}
                            {invTab === 'stocks' && <th className="p-3 text-right">Venta</th>}
                            <th className="p-3 text-right font-bold text-white">Ganancia</th>
                            {invTab === 'stocks' && <th className="p-3 text-right">ROI</th>}
                            <th className="p-3 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {(invTab === 'stocks' ? stocks : dividends).map(item => {
                            const val = invTab === 'stocks' ? item.profit : item.amount;

                            return (
                                <tr key={item.id} className="hover:bg-slate-800/50">
                                    <td className="p-3">{format(new Date(item.date), 'dd MMM yyyy', { locale: es })}</td>
                                    <td className="p-3 font-bold text-slate-200">{item.company}</td>
                                    {invTab === 'stocks' && <td className="p-3 text-right text-slate-400">{item.buyAmount.toFixed(2)}€</td>}
                                    {invTab === 'stocks' && <td className="p-3 text-right text-slate-400">{item.sellAmount.toFixed(2)}€</td>}
                                    <td className={`p-3 text-right font-bold ${val >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {val.toFixed(2)}€
                                    </td>
                                    {invTab === 'stocks' && (
                                        <td className={`p-3 text-right font-mono text-xs ${item.roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {item.roi.toFixed(2)}%
                                        </td>
                                    )}
                                    <td className="p-3">
                                        <button onClick={() => handleDelete(item.id)} className="text-slate-600 hover:text-red-400"><Trash2 size={16} /></button>
                                    </td>
                                </tr>
                            )
                        })}
                        {(invTab === 'stocks' ? stocks : dividends).length === 0 && (
                            <tr><td colSpan={7} className="p-8 text-center text-slate-500">No hay registros este año.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl text-xs text-blue-300">
                ℹ️ <b>Nota fiscal:</b> Estos datos son meramente informativos para tu control personal y facilitación de la declaración de la renta. Verifica siempre los datos con tu broker.
            </div>
        </div>
    )
}

const AccountsView = ({ year, transactions, userId }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [concept, setConcept] = useState("");
    const [amount, setAmount] = useState("");

    // Calculations
    const totalBalance = transactions.reduce((acc, curr) => acc + curr.amount, 0);
    const yearContribution = transactions
        .filter(t => t.year === year && t.amount > 0)
        .reduce((acc, curr) => acc + curr.amount, 0);

    const handleAdd = async (e) => {
        e.preventDefault();

        await addDoc(collection(db, 'users', userId, 'investments'), {
            type: 'savings',
            date,
            year: Number(date.split('-')[0]), // Use the date's year, not just the current view year
            concept,
            amount: Number(amount),
            createdAt: new Date().toISOString()
        });

        setIsAdding(false);
        setConcept(""); setAmount("");
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar este movimiento?')) return;
        await deleteDoc(doc(db, 'users', userId, 'investments', id));
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 p-4 rounded-xl border bg-surface border-slate-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-emerald-500/20 p-2 rounded-lg text-emerald-400"><Wallet size={20} /></div>
                        <h3 className="font-medium text-slate-400 text-sm">Saldo Cuenta Remunerada</h3>
                    </div>
                    <p className="text-3xl font-bold text-white">{totalBalance.toFixed(2)}€</p>
                    <p className="text-xs text-slate-500 mt-1">Saldo total acumulado</p>
                </div>

                <div className="flex-1 p-4 rounded-xl border bg-surface border-slate-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400"><TrendingUp size={20} /></div>
                        <h3 className="font-medium text-slate-400 text-sm">Aportado en {year}</h3>
                    </div>
                    <p className="text-3xl font-bold text-blue-400">{yearContribution.toFixed(2)}€</p>
                    <p className="text-xs text-slate-500 mt-1">Transferencias este año</p>
                </div>
            </div>

            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-200">Historial de Movimientos</h2>
                <button onClick={() => setIsAdding(!isAdding)} className="bg-amber-500 text-black px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                    {isAdding ? <X size={16} /> : <Plus size={16} />}
                    {isAdding ? 'Cancelar' : 'Añadir Movimiento'}
                </button>
            </div>

            {isAdding && (
                <div className="bg-slate-900/50 p-4 rounded-xl border border-dashed border-slate-700 animate-in slide-in-from-top-4">
                    <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                        <div><label className="text-xs text-slate-400">Fecha</label><input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-800 border-slate-700 rounded-lg p-2 text-sm" /></div>
                        <div><label className="text-xs text-slate-400">Concepto</label><input required value={concept} onChange={e => setConcept(e.target.value)} placeholder="Ej. Aportación mensual" className="w-full bg-slate-800 border-slate-700 rounded-lg p-2 text-sm" /></div>
                        <div><label className="text-xs text-slate-400">Importe (€)</label><input type="number" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-slate-800 border-slate-700 rounded-lg p-2 text-sm" placeholder="Positivo o negativo" /></div>
                        <button className="bg-emerald-500 text-white p-2 rounded-lg font-bold">Guardar</button>
                    </form>
                </div>
            )}

            <div className="bg-surface rounded-xl border border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-900 text-slate-400">
                        <tr>
                            <th className="p-3 text-left">Fecha</th>
                            <th className="p-3 text-left">Concepto</th>
                            <th className="p-3 text-right">Importe</th>
                            <th className="p-3 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {transactions.map(item => (
                            <tr key={item.id} className="hover:bg-slate-800/50">
                                <td className="p-3">{format(new Date(item.date), 'dd MMM yyyy', { locale: es })}</td>
                                <td className="p-3 font-medium text-slate-200">{item.concept}</td>
                                <td className={`p-3 text-right font-bold ${item.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {item.amount > 0 ? '+' : ''}{item.amount.toFixed(2)}€
                                </td>
                                <td className="p-3 text-right">
                                    <button onClick={() => handleDelete(item.id)} className="text-slate-600 hover:text-red-400"><Trash2 size={16} /></button>
                                </td>
                            </tr>
                        ))}
                        {transactions.length === 0 && (
                            <tr><td colSpan={4} className="p-8 text-center text-slate-500">No hay movimientos registrados.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

        </div>
    )
}
