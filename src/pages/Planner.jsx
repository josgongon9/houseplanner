import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, isPast, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, AlertTriangle, PlusCircle, X, Home, Calendar, Trash2, Check } from 'lucide-react';

export default function Planner() {
    const { meals, menu, setMenuItem, household } = useStore();
    const [currentDate, setCurrentDate] = useState(new Date());

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(null); // { date: string, type: 'lunch'|'dinner' }
    const [selectedMeals, setSelectedMeals] = useState([]); // Array of {mealId, portion}

    // Search and Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all'); // 'all', 'lunch', 'dinner', 'both'

    // Calculate usage counts with portions
    const usedCounts = useMemo(() => {
        const counts = {};
        Object.values(menu).forEach(menuEntry => {
            if (!menuEntry) return; // Skip if undefined/null

            // New format: menuEntry.meals is an array of {mealId, portion}
            if (menuEntry.meals && Array.isArray(menuEntry.meals)) {
                menuEntry.meals.forEach(({ mealId, portion }) => {
                    counts[mealId] = (counts[mealId] || 0) + Number(portion);
                });
            } else if (menuEntry.mealId) {
                // Legacy format: single mealId (backward compatibility)
                counts[menuEntry.mealId] = (counts[menuEntry.mealId] || 0) + 1;
            }
        });
        return counts;
    }, [menu]);

    const startOfCurrentWeek = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }).map((_, i) => addDays(startOfCurrentWeek, i));

    const handleSlotClick = (dateStr, type) => {
        const menuEntry = menu[`${dateStr}-${type}`];
        let currentMeals = [];

        if (menuEntry) {
            if (menuEntry.meals && Array.isArray(menuEntry.meals)) {
                // New format
                currentMeals = [...menuEntry.meals];
            } else if (menuEntry.mealId) {
                // Legacy format - convert to new
                currentMeals = [{ mealId: menuEntry.mealId, portion: 1 }];
            }
        }

        setSelectedMeals(currentMeals);
        setSelectedSlot({ date: dateStr, type });
        setIsModalOpen(true);
    };

    const handleAddMeal = (mealId) => {
        const existing = selectedMeals.find(m => m.mealId === mealId);
        let newMeals = [];

        if (existing) {
            // Increment portion by 0.5 if it exists
            newMeals = selectedMeals.map(m =>
                m.mealId === mealId ? { ...m, portion: m.portion + 0.5 } : m
            );
        } else {
            // Adding a new meal
            newMeals = [...selectedMeals, { mealId, portion: 0.5 }];
        }

        // Auto-adjust portions based on count
        if (newMeals.length === 1) {
            newMeals[0].portion = 1.0;
        } else if (newMeals.length === 2) {
            newMeals = newMeals.map(m => ({ ...m, portion: 0.5 }));
        }

        setSelectedMeals(newMeals);
    };

    const handleUpdatePortion = (mealId, newPortion) => {
        if (newPortion <= 0) {
            handleRemoveMeal(mealId);
        } else {
            setSelectedMeals(selectedMeals.map(m =>
                m.mealId === mealId ? { ...m, portion: Number(newPortion) } : m
            ));
        }
    };

    const handleRemoveMeal = (mealId) => {
        let newMeals = selectedMeals.filter(m => m.mealId !== mealId);

        // Auto-adjust back to 1.0 if only one remains
        if (newMeals.length === 1) {
            newMeals = [{ ...newMeals[0], portion: 1.0 }];
        }

        setSelectedMeals(newMeals);
    };

    const handleSave = async () => {
        if (selectedSlot) {
            await setMenuItem(selectedSlot.date, selectedSlot.type, selectedMeals);
            setIsModalOpen(false);
            setSearchQuery('');
            setFilterType('all');
        }
    };

    const handleClear = async () => {
        if (selectedSlot) {
            await setMenuItem(selectedSlot.date, selectedSlot.type, []);
            setIsModalOpen(false);
            setSearchQuery('');
            setFilterType('all');
        }
    };

    // Helper to render a slot
    const renderSlot = (day, type) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const menuEntry = menu[`${dateStr}-${type}`];
        const dayIsPast = isPast(day) && !isToday(day);

        let slotMeals = [];
        if (menuEntry) {
            if (menuEntry.meals && Array.isArray(menuEntry.meals)) {
                slotMeals = menuEntry.meals;
            } else if (menuEntry.mealId) {
                slotMeals = [{ mealId: menuEntry.mealId, portion: 1 }];
            }
        }

        // Check stock for each meal
        const hasStockIssue = slotMeals.some(({ mealId }) => {
            const meal = meals.find(m => m.id === mealId);
            return meal && (usedCounts[meal.id] > meal.quantity);
        });

        return (
            <div
                onClick={() => !dayIsPast && handleSlotClick(dateStr, type)}
                aria-label={`Slot ${type} ${dateStr}`}
                className={`
                    relative p-3 rounded-xl border min-h-[100px] flex flex-col justify-center items-center text-center cursor-pointer transition-all
                    ${slotMeals.length > 0 ? 'bg-surface border-slate-600 shadow-sm' : 'border-dashed border-slate-700 hover:bg-slate-800/50'}
                    ${dayIsPast ? 'opacity-40 grayscale-[0.5] cursor-default bg-slate-900/20' : ''}
                    ${isToday(day) ? 'ring-1 ring-emerald-500/30' : ''}
                `}
            >
                {slotMeals.length === 0 && !dayIsPast && (
                    <div className="w-full flex flex-col items-center justify-center">
                        <PlusCircle className="text-slate-600 mb-1" size={20} />
                        <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Planificar</span>
                    </div>
                )}
                {slotMeals.length === 0 && dayIsPast && (
                    <div className="w-full flex items-center justify-center">
                        <span className="text-xs text-slate-600 italic">No registrado</span>
                    </div>
                )}

                {slotMeals.length > 0 && (
                    <>
                        <div className="space-y-2 w-full">
                            {slotMeals.map(({ mealId, portion }, index) => {
                                const meal = meals.find(m => m.id === mealId);
                                if (!meal) return null;
                                return (
                                    <div key={mealId} className="w-full">
                                        <div className={`font-bold text-base leading-snug ${dayIsPast ? 'text-slate-500' : 'text-white'}`}>
                                            {meal.name}
                                        </div>
                                        {index < slotMeals.length - 1 && (
                                            <div className="w-full h-[1px] bg-slate-600/40 my-2"></div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {hasStockIssue && !dayIsPast && (
                            <div className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg animate-pulse" title="Stock insuficiente">
                                <AlertTriangle size={12} />
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    };

    // Date Range Formatter
    const dateRangeLabel = useMemo(() => {
        const start = startOfCurrentWeek;
        const end = addDays(startOfCurrentWeek, 6);

        if (format(start, 'MMM') === format(end, 'MMM')) {
            return `Del ${format(start, 'd')} al ${format(end, 'd')} de ${format(start, 'MMMM', { locale: es })}`;
        } else {
            return `Del ${format(start, 'd')} de ${format(start, 'MMM', { locale: es })} al ${format(end, 'd')} de ${format(end, 'MMM', { locale: es })}`;
        }
    }, [startOfCurrentWeek]);

    return (
        <div className="pb-24">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-slate-800 shadow-xl">
                <div className="px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                        {household && (
                            <div className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-lg border border-emerald-500/20 flex items-center gap-1.5 animate-in fade-in">
                                <Home size={12} />
                                <span className="text-[10px] font-bold tracking-tight uppercase truncate max-w-[150px]">
                                    {household.name}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-4 pb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
                            className="p-1.5 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <div className="flex flex-col">
                            <h2 className="text-sm font-bold capitalize text-white leading-tight">
                                {format(startOfCurrentWeek, 'MMMM yyyy', { locale: es })}
                            </h2>
                            <span className="text-[10px] text-slate-400 font-medium">
                                {dateRangeLabel}
                            </span>
                        </div>
                        <button
                            onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
                            className="p-1.5 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    {!isSameDay(startOfWeek(new Date(), { weekStartsOn: 1 }), startOfCurrentWeek) && (
                        <button
                            onClick={() => setCurrentDate(new Date())}
                            className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 flex items-center gap-1"
                        >
                            <Calendar size={14} />
                            <span className="text-[10px] font-bold">Hoy</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Grid */}
            <div className="p-4 space-y-6">
                {days.map(day => {
                    const dayIsPast = isPast(day) && !isToday(day);
                    const dayIsToday = isToday(day);

                    return (
                        <div key={day.toString()} className={`animate-in fade-in duration-500 ${dayIsPast ? 'opacity-90' : ''}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <h3 className={`font-bold text-lg capitalize transition-colors ${dayIsToday ? 'text-emerald-400' : dayIsPast ? 'text-slate-500' : 'text-slate-200'}`}>
                                    {format(day, 'EEEE d', { locale: es })}
                                </h3>
                                {dayIsToday && (
                                    <span className="bg-emerald-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded uppercase flex items-center gap-0.5">
                                        <div className="w-1 h-1 bg-black rounded-full animate-pulse " /> Hoy
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <span className="text-xs text-slate-500 font-medium ml-1">ALMUERZO</span>
                                    {renderSlot(day, 'lunch')}
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-slate-500 font-medium ml-1">CENA</span>
                                    {renderSlot(day, 'dinner')}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal / Bottom Sheet */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
                    <div className="bg-surface w-full max-w-md h-[85vh] sm:h-auto sm:max-h-[85vh] rounded-t-2xl sm:rounded-2xl flex flex-col shadow-2xl animate-in slide-in-from-bottom-10">
                        <div className="p-4 border-b border-slate-700 flex justify-between items-center sticky top-0 bg-surface z-10">
                            <h3 className="font-bold text-lg">Planificar Comida</h3>
                            <button
                                onClick={() => {
                                    setIsModalOpen(false);
                                    setSearchQuery('');
                                    setFilterType('all');
                                }}
                                className="p-2 bg-slate-800 rounded-full"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Selected Meals Summary */}
                        {selectedMeals.length > 0 && (
                            <div className="p-4 bg-slate-900/50 border-b border-slate-700 space-y-2">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-slate-400">COMIDAS SELECCIONADAS</span>
                                    <button
                                        onClick={handleClear}
                                        className="text-xs text-red-400 hover:text-red-300 font-bold"
                                    >
                                        Limpiar todo
                                    </button>
                                </div>
                                {selectedMeals.map(({ mealId, portion }) => {
                                    const meal = meals.find(m => m.id === mealId);
                                    if (!meal) return null;
                                    return (
                                        <div key={mealId} className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg">
                                            <div className="flex-1">
                                                <div className="font-medium text-sm">{meal.name}</div>
                                            </div>
                                            <div className="flex items-center gap-2 bg-slate-900 rounded-lg p-1">
                                                <button
                                                    onClick={() => handleUpdatePortion(mealId, portion - 0.5)}
                                                    className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                                                >-</button>
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    min="0.5"
                                                    value={portion}
                                                    onChange={(e) => handleUpdatePortion(mealId, e.target.value)}
                                                    className="w-12 bg-transparent text-center font-bold text-sm outline-none"
                                                />
                                                <button
                                                    onClick={() => handleUpdatePortion(mealId, portion + 0.5)}
                                                    className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                                                >+</button>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveMeal(mealId)}
                                                className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Available Meals */}
                        <div className="p-4 overflow-y-auto flex-1 space-y-3">
                            <div className="text-xs font-bold text-slate-400">AÑADIR COMIDA</div>

                            {/* Search Bar */}
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Buscar comida..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 pl-9 text-sm outline-none focus:border-emerald-500 transition-colors"
                                />
                                <PlusCircle className="absolute left-3 top-2.5 text-slate-500" size={16} />
                            </div>

                            {/* Filter Chips */}
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    onClick={() => setFilterType('all')}
                                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${filterType === 'all'
                                        ? 'bg-emerald-500 text-black'
                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                        }`}
                                >
                                    Todas
                                </button>
                                <button
                                    onClick={() => setFilterType('lunch')}
                                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${filterType === 'lunch'
                                        ? 'bg-yellow-500 text-black'
                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                        }`}
                                >
                                    🍽️ Almuerzo
                                </button>
                                <button
                                    onClick={() => setFilterType('dinner')}
                                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${filterType === 'dinner'
                                        ? 'bg-indigo-500 text-black'
                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                        }`}
                                >
                                    🌙 Cena
                                </button>
                            </div>

                            {/* Filtered Meals List */}
                            <div className="space-y-2">
                                {meals
                                    .filter(meal => {
                                        // Search filter
                                        const matchesSearch = meal.name.toLowerCase().includes(searchQuery.toLowerCase());

                                        // Type filter
                                        let matchesType = true;
                                        if (filterType === 'lunch') {
                                            matchesType = meal.type === 'lunch' || meal.type === 'both';
                                        } else if (filterType === 'dinner') {
                                            matchesType = meal.type === 'dinner' || meal.type === 'both';
                                        }

                                        return matchesSearch && matchesType;
                                    })
                                    .map(meal => {
                                        const count = usedCounts[meal.id] || 0;
                                        const available = meal.quantity;
                                        const isStockLow = count >= available;
                                        const isSelected = selectedMeals.some(m => m.mealId === meal.id);

                                        return (
                                            <button
                                                key={meal.id}
                                                onClick={() => handleAddMeal(meal.id)}
                                                className={`w-full text-left p-3 rounded-xl bg-slate-900/50 hover:bg-slate-800 border transition-all flex justify-between items-center ${isSelected ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700'
                                                    }`}
                                            >
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">{meal.name}</span>
                                                        {isSelected && <Check size={14} className="text-emerald-500" />}
                                                    </div>
                                                    <div className="text-xs text-slate-400 capitalize">
                                                        {meal.type === 'both' ? 'Cualquiera' : meal.type === 'lunch' ? 'Almuerzo' : 'Cena'}
                                                    </div>
                                                </div>
                                                <div className="text-xs text-right">
                                                    <div className={`font-bold ${isStockLow ? 'text-red-400' : 'text-green-400'}`}>
                                                        Stock: {Number(available).toFixed(1)}
                                                    </div>
                                                    <div className="text-slate-500">Usado: {count.toFixed(1)}</div>
                                                </div>
                                            </button>
                                        );
                                    })}
                            </div>
                        </div>

                        {/* Save Button */}
                        <div className="p-4 border-t border-slate-700 sticky bottom-0 bg-surface">
                            <button
                                onClick={handleSave}
                                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors"
                            >
                                Guardar ({selectedMeals.length} {selectedMeals.length === 1 ? 'comida' : 'comidas'})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
