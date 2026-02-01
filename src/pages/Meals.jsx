import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Plus, Trash2, Search, ChefHat, X, Save, FileText, List, Calendar, AlertTriangle } from 'lucide-react';

export default function Meals() {
    const { meals, menu, addMeal, updateMealStock, updateMeal, deleteMeal } = useStore();
    const [showAdd, setShowAdd] = useState(false);
    const [search, setSearch] = useState("");

    // Detail Modal State
    const [editingMeal, setEditingMeal] = useState(null);
    const [notes, setNotes] = useState("");
    const [ingredients, setIngredients] = useState("");
    const [editingQuantity, setEditingQuantity] = useState(0);

    // Form State (New Meal)
    const [name, setName] = useState("");
    const [type, setType] = useState("both");
    const [quantity, setQuantity] = useState(1);

    useEffect(() => {
        if (editingMeal) {
            setNotes(editingMeal.notes || "");
            setIngredients(editingMeal.ingredients || "");
            setEditingQuantity(editingMeal.quantity || 0);
        }
    }, [editingMeal]);

    // Calculate usage counts from menu
    const plannedCounts = useMemo(() => {
        const counts = {};
        Object.values(menu).forEach(menuEntry => {
            if (!menuEntry || menuEntry.processed) return; // Only count unprocessed meals

            let mealsToProcess = [];
            if (menuEntry.meals && Array.isArray(menuEntry.meals)) {
                mealsToProcess = menuEntry.meals;
            } else if (menuEntry.mealId) {
                mealsToProcess = [{ mealId: menuEntry.mealId, portion: 1 }];
            }

            mealsToProcess.forEach(({ mealId, portion }) => {
                counts[mealId] = (counts[mealId] || 0) + Number(portion);
            });
        });
        return counts;
    }, [menu]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name) return;
        addMeal(name, type, quantity);
        setName("");
        setQuantity(1);
        setShowAdd(false);
    };

    const handleUpdateRecipe = async () => {
        if (!editingMeal) return;
        await updateMeal(editingMeal.id, {
            notes,
            ingredients,
            quantity: Number(editingQuantity)
        });
        setEditingMeal(null);
    };

    const filteredMeals = meals
        .filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="p-4 space-y-4 max-w-md mx-auto w-full">
            <header className="flex justify-between items-center">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Comidas</h1>
                <button
                    onClick={() => setShowAdd(!showAdd)}
                    className="bg-primary hover:bg-blue-600 text-white p-2 rounded-full shadow-lg transition-transform active:scale-95"
                >
                    <Plus size={24} />
                </button>
            </header>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                <input
                    type="text"
                    placeholder="Buscar..."
                    className="w-full bg-surface border border-slate-700 rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:border-primary transition-colors"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Add Form */}
            {showAdd && (
                <form onSubmit={handleSubmit} className="bg-surface p-4 rounded-xl border border-slate-700 space-y-4 animate-in slide-in-from-top-4 fade-in">
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Nombre</label>
                        <input
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 focus:border-primary outline-none"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Ej. Lentejas"
                        />
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-slate-400 mb-1">Tipo</label>
                            <select
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 outline-none"
                                value={type}
                                onChange={e => setType(e.target.value)}
                            >
                                <option value="lunch">Almuerzo</option>
                                <option value="dinner">Cena</option>
                                <option value="both">Ambos</option>
                            </select>
                        </div>
                        <div className="w-28">
                            <label className="block text-xs font-medium text-slate-400 mb-1">Stock (porciones)</label>
                            <input
                                type="number"
                                step="0.5"
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 outline-none"
                                value={quantity}
                                onChange={e => setQuantity(e.target.value)}
                                min="0"
                            />
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-primary text-white font-bold py-2 rounded-lg hover:bg-blue-600">
                        Guardar
                    </button>
                </form>
            )}

            {/* List */}
            <div className="space-y-3 pb-20">
                {filteredMeals.map(meal => {
                    const planned = plannedCounts[meal.id] || 0;
                    const hasStockIssue = planned > meal.quantity;

                    return (
                        <div key={meal.id} className={`bg-surface p-3 rounded-xl border flex justify-between items-center shadow-md hover:border-slate-500 transition-colors ${hasStockIssue ? 'border-red-500/50 bg-red-500/5' : 'border-slate-700'}`}>
                            <div className="flex-1 cursor-pointer" onClick={() => setEditingMeal(meal)}>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-lg">{meal.name}</h3>
                                    {(meal.notes || meal.ingredients) && <ChefHat size={14} className="text-emerald-400" />}
                                    {hasStockIssue && (
                                        <div className="bg-red-500 text-white p-1 rounded-full animate-pulse" title="¡Necesitas cocinar más!">
                                            <AlertTriangle size={12} />
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${meal.type === 'lunch' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/20' :
                                        meal.type === 'dinner' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/20' :
                                            'bg-slate-800 text-slate-400 border border-slate-700'
                                        }`}>
                                        {meal.type === 'lunch' ? 'Almuerzo' : meal.type === 'dinner' ? 'Cena' : 'Cualquiera'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <div className={`flex flex-col items-center justify-center min-w-[50px] rounded-xl p-2 border transition-colors ${(plannedCounts[meal.id] || 0) > 0
                                        ? 'bg-blue-500/10 border-blue-500/30'
                                        : 'bg-slate-900 border-slate-800'
                                        }`}>
                                        <span className={`text-[10px] font-bold uppercase tracking-tighter mb-0.5 ${(plannedCounts[meal.id] || 0) > 0 ? 'text-blue-400/80' : 'text-slate-500'
                                            }`}>Menú</span>
                                        <span className={`font-black text-base ${(plannedCounts[meal.id] || 0) > 0 ? 'text-blue-400' : 'text-slate-500'}`}>
                                            {(plannedCounts[meal.id] || 0).toFixed(1)}
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-center justify-center min-w-[50px] bg-slate-900 rounded-xl p-2 border border-slate-800">
                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mb-0.5">Stock</span>
                                        <span className={`font-black text-base ${meal.quantity === 0 ? 'text-red-500' : 'text-white'}`}>
                                            {Number(meal.quantity).toFixed(1)}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.confirm(`¿Estás seguro de que quieres eliminar "${meal.name}"? Esta acción no se puede deshacer.`)) {
                                            deleteMeal(meal.id);
                                        }
                                    }}
                                    aria-label={`Eliminar ${meal.name}`}
                                    className="text-slate-500 hover:text-red-400 transition-colors p-2"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>
                    );
                })}

                {filteredMeals.length === 0 && (
                    <div className="text-center py-10 text-slate-500">
                        No hay comidas registradas. ¡Añade algunas!
                    </div>
                )}
            </div>

            {/* Recipe / Detail Modal */}
            {
                editingMeal && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
                        <div className="bg-surface w-full max-w-2xl h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10">
                            {/* Modal Header */}
                            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                                <div>
                                    <h2 className="text-xl font-bold text-white">{editingMeal.name}</h2>
                                    <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Recetario y Notas</p>
                                </div>
                                <button
                                    onClick={() => setEditingMeal(null)}
                                    className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Stock Adjustment Section */}
                                <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Stock Disponible</label>
                                        <div className="text-2xl font-black text-white">{Number(editingQuantity).toFixed(1)} <span className="text-xs text-slate-500 font-medium">porciones</span></div>
                                    </div>
                                    <div className="flex items-center gap-3 bg-black/20 p-1.5 rounded-xl border border-slate-800">
                                        <button
                                            onClick={() => setEditingQuantity(Math.max(0, Number(editingQuantity) - 0.5))}
                                            className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-bold text-xl"
                                        >-</button>
                                        <input
                                            type="number"
                                            step="0.5"
                                            className="w-16 bg-transparent text-center font-black text-lg outline-none"
                                            value={editingQuantity}
                                            onChange={e => setEditingQuantity(e.target.value)}
                                        />
                                        <button
                                            onClick={() => setEditingQuantity(Number(editingQuantity) + 0.5)}
                                            className="w-10 h-10 flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-bold text-xl"
                                        >+</button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-sm font-bold text-emerald-400 uppercase tracking-wider">
                                        <List size={16} />
                                        Ingredientes / Cantidades
                                    </label>
                                    <textarea
                                        className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-4 text-sm text-slate-200 focus:border-emerald-500 outline-none min-h-[120px] transition-all"
                                        placeholder="Ej: 200g Lentejas, 1 Chorizo, 2 Patatas..."
                                        value={ingredients}
                                        onChange={e => setIngredients(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-sm font-bold text-blue-400 uppercase tracking-wider">
                                        <FileText size={16} />
                                        Preparación / Notas
                                    </label>
                                    <textarea
                                        className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-4 text-sm text-slate-200 focus:border-blue-500 outline-none min-h-[200px] transition-all"
                                        placeholder="Ej: Sofreír la cebolla, añadir las lentejas y dejar cocer 40 min..."
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-6 pb-12 sm:pb-6 border-t border-slate-800 bg-slate-900/50">
                                <button
                                    onClick={handleUpdateRecipe}
                                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98]"
                                >
                                    <Save size={20} />
                                    Guardar Receta
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
