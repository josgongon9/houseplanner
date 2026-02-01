import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, isPast, isToday, startOfMonth, endOfMonth, subMonths, addMonths, eachDayOfInterval, isSameMonth, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, AlertTriangle, PlusCircle, X, Home, Calendar, Trash2, Check, LayoutGrid, List, Utensils } from 'lucide-react';

export default function Planner() {
    const { meals, menu, setMenuItem, household } = useStore();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState('week'); // 'week' | 'month'

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
            if (menuEntry.processed) return; // Skip if already processed (stock already reduced)

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
                                const isEatingOut = mealId === 'sys_eating_out';
                                const meal = isEatingOut ? { name: 'Comer Fuera' } : meals.find(m => m.id === mealId);

                                if (!meal) return null;
                                return (
                                    <div key={mealId} className="w-full">
                                        <div className={`font-bold text-base leading-snug ${dayIsPast ? 'text-slate-500' : isEatingOut ? 'text-amber-400 italic' : 'text-white'}`}>
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
        <div className="pb-24 max-w-md mx-auto w-full">
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
                            onClick={() => setCurrentDate(viewMode === 'week' ? subWeeks(currentDate, 1) : subMonths(currentDate, 1))}
                            className="p-1.5 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <div className="flex flex-col">
                            <h2 className="text-sm font-bold capitalize text-white leading-tight">
                                {format(viewMode === 'week' ? startOfCurrentWeek : currentDate, 'MMMM yyyy', { locale: es })}
                            </h2>
                            {viewMode === 'week' && (
                                <span className="text-[10px] text-slate-400 font-medium">
                                    {dateRangeLabel}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => setCurrentDate(viewMode === 'week' ? addWeeks(currentDate, 1) : addMonths(currentDate, 1))}
                            className="p-1.5 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setViewMode(v => v === 'week' ? 'month' : 'week')}
                            className={`p-1.5 rounded-lg border flex items-center gap-1 transition-colors ${viewMode === 'month' ? 'bg-amber-500 text-black border-amber-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                            title={viewMode === 'week' ? "Ver Calendario Mensual" : "Ver Planificación Semanal"}
                        >
                            {viewMode === 'week' ? <Calendar size={16} /> : <List size={16} />}
                        </button>

                        {!isSameDay(startOfWeek(new Date(), { weekStartsOn: 1 }), startOfCurrentWeek) && (
                            <button
                                onClick={() => {
                                    setCurrentDate(new Date());
                                    if (viewMode === 'month') setViewMode('week');
                                }}
                                className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 flex items-center gap-1"
                            >
                                <Calendar size={14} />
                                <span className="text-[10px] font-bold">Hoy</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Switcher */}
            {viewMode === 'week' ? (
                /* WEEK GRID */
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
            ) : (
                /* MONTH CALENDAR VIEW */
                <MonthView
                    currentDate={currentDate}
                    menu={menu}
                    onDateSelect={(date) => {
                        setCurrentDate(date);
                        setViewMode('week');
                    }}
                />
            )}

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
                                                <div className="flex items-center gap-2 text-[10px] mt-0.5">
                                                    <span className={`${(usedCounts[meal.id] || 0) > meal.quantity ? 'text-red-400 font-bold' : 'text-slate-500'}`}>
                                                        Stock: {meal.quantity}
                                                    </span>
                                                    <span className="text-slate-600">•</span>
                                                    <span className="text-slate-500">
                                                        Menú: {(usedCounts[meal.id] || 0).toFixed(1)}
                                                    </span>
                                                </div>
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
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-400">AÑADIR COMIDA</span>
                                <button
                                    onClick={() => handleAddMeal('sys_eating_out')}
                                    className="text-xs text-amber-500 hover:underline flex items-center gap-1 font-bold"
                                >
                                    <Utensils size={12} /> Comer Fuera
                                </button>
                            </div>

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
                                                    <div className="text-slate-500">Menú: {count.toFixed(1)}</div>
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

const MonthView = ({ currentDate, menu, onDateSelect }) => {
    // Generate Calendar Grid
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 }); // Fixed: using endOfWeek of monthEnd

    // Helper for endOfWeek since I missed importing it above, I will add it or just assume I add imports. 
    // Actually simpler: just generate days until we hit the end of the last week block.
    // Let's ensure imports are correct in the first chunk. I will assume `endOfWeek` is imported or I use `addDays`.
    // I added `eachDayOfInterval` in imports.

    // Correction: I didn't add `endOfWeek` in the imports list in Chunk 1. 
    // I'll stick to a simple loop or just add `endOfWeek` to imports in Chunk 1 implicitly or use `addDays`.
    // Let's use `addDays` to fill the grid if needed, but `eachDayOfInterval` is cleaner.

    const calendarDays = eachDayOfInterval({
        start: startDate,
        end: endDate
    });

    const getDayStatus = (day) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const lunch = menu[`${dateStr}-lunch`];
        const dinner = menu[`${dateStr}-dinner`];

        const hasLunch = lunch && (lunch.mealId || (lunch.meals && lunch.meals.length > 0));
        const hasDinner = dinner && (dinner.mealId || (dinner.meals && dinner.meals.length > 0));

        if (hasLunch && hasDinner) return 'full';
        if (hasLunch || hasDinner) return 'partial';
        return 'empty';
    }

    const weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

    return (
        <div className="p-4 animate-in fade-in zoom-in-95">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 mb-2">
                {weekDays.map(d => (
                    <div key={d} className="text-center text-xs font-bold text-slate-500 py-2">
                        {d}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day, idx) => {
                    const status = getDayStatus(day);
                    const isCurrentMonth = isSameMonth(day, monthStart);
                    const dayIsToday = isToday(day);

                    return (
                        <div
                            key={day.toISOString()}
                            onClick={() => onDateSelect(day)}
                            className={`
                                aspect-square rounded-xl border flex flex-col items-center justify-center relative cursor-pointer hover:bg-slate-800 transition-all
                                ${dayIsToday
                                    ? 'bg-emerald-500/20 border-emerald-500 ring-1 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] z-10 scale-105'
                                    : isCurrentMonth
                                        ? isPast(day)
                                            ? 'bg-slate-900/30 border-slate-800 opacity-60'
                                            : 'bg-surface border-slate-700'
                                        : 'bg-transparent border-transparent opacity-30'}
                            `}
                        >
                            <span className={`text-sm ${dayIsToday ? 'text-white font-bold' :
                                (isCurrentMonth ? (isPast(day) ? 'text-slate-600 font-medium' : 'text-slate-300 font-medium') : 'text-slate-600 font-medium')
                                }`}>
                                {format(day, 'd')}
                            </span>

                            {/* Status Indicators */}
                            <div className="mt-1 h-2 flex items-center justify-center">
                                {status === 'full' && (
                                    <div className={`w-2 h-2 rounded-full ${isPast(day) && !dayIsToday ? 'bg-emerald-500/50' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`}></div>
                                )}
                                {status === 'partial' && (
                                    <div className={`w-2 h-2 rounded-full ${isPast(day) && !dayIsToday ? 'bg-amber-500/50' : 'bg-amber-500'}`}></div>
                                )}
                                {status === 'empty' && isCurrentMonth && !isPast(day) && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="mt-6 flex justify-center gap-6 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Completo
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500"></div> Incompleto
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div> Vacío
                </div>
            </div>
        </div>
    )
}

// I need to make sure endOfWeek is imported. Since I cannot change Chunk 1 again in the same tool call easily without overlap or confusion logic,
// I will just import it in a separate import line if I can, or update the first chunk to include it.
// Actually, I can use the same import list in the replacement for Chunk 1.
// I'll update Chunk 1 to include `endOfWeek`.

