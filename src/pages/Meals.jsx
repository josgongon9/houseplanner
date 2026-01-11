import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Plus, Trash2, Search } from 'lucide-react';

export default function Meals() {
    const { meals, addMeal, updateMealStock, deleteMeal } = useStore();
    const [showAdd, setShowAdd] = useState(false);
    const [search, setSearch] = useState("");

    // Form State
    const [name, setName] = useState("");
    const [type, setType] = useState("both");
    const [quantity, setQuantity] = useState(1);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name) return;
        addMeal(name, type, quantity);
        setName("");
        setQuantity(1);
        setShowAdd(false);
    };

    const filteredMeals = meals.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="p-4 space-y-4">
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
                        <div className="w-24">
                            <label className="block text-xs font-medium text-slate-400 mb-1">Stock</label>
                            <input
                                type="number"
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
                {filteredMeals.map(meal => (
                    <div key={meal.id} className="bg-surface p-3 rounded-xl border border-slate-700 flex justify-between items-center shadow-sm">
                        <div>
                            <h3 className="font-semibold text-lg">{meal.name}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${meal.type === 'lunch' ? 'bg-yellow-500/20 text-yellow-400' :
                                    meal.type === 'dinner' ? 'bg-indigo-500/20 text-indigo-400' :
                                        'bg-slate-700 text-slate-300'
                                }`}>
                                {meal.type === 'lunch' ? 'Almuerzo' : meal.type === 'dinner' ? 'Cena' : 'Cualquiera'}
                            </span>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 bg-slate-900 rounded-lg p-1">
                                <button
                                    onClick={() => updateMealStock(meal.id, Math.max(0, meal.quantity - 1))}
                                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white"
                                >-</button>
                                <span className={`w-6 text-center font-bold ${meal.quantity === 0 ? 'text-red-500' : 'text-white'}`}>{meal.quantity}</span>
                                <button
                                    onClick={() => updateMealStock(meal.id, meal.quantity + 1)}
                                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white"
                                >+</button>
                            </div>
                            <button onClick={() => deleteMeal(meal.id)} className="text-slate-500 hover:text-red-400">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}

                {filteredMeals.length === 0 && (
                    <div className="text-center py-10 text-slate-500">
                        No hay comidas registradas. ¡Añade algunas!
                    </div>
                )}
            </div>
        </div>
    );
}
