import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
// import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay } from 'date-fns';
// Note: importing from date-fns directly doesn't work well in some ESM envs without specific paths if not configured, 
// but standard vite setup handles 'date-fns'. 
// I'll assume standard import works.
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, startOfDay, isPast, isToday, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, AlertTriangle, PlusCircle, X, Home, Calendar } from 'lucide-react';

export default function Planner() {
    const { meals, menu, setMenuItem, household } = useStore();
    const [currentDate, setCurrentDate] = useState(new Date());

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(null); // { date: string, type: 'lunch'|'dinner' }

    // Calculate generic usage counts across the ENTIRE menu (not just this week, assuming stock is total global stock)
    // If the user clears history, stock logic might be tricky. 
    // Assuming 'menu' contains all future/past meals.
    // The user requirement: "Si he añadido por ejemplo 3... pero solo tengo 2... alerta".
    const usedCounts = useMemo(() => {
        const counts = {};
        Object.values(menu).forEach(mealId => {
            counts[mealId] = (counts[mealId] || 0) + 1;
        });
        return counts;
    }, [menu]);

    const startOfCurrentWeek = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }).map((_, i) => addDays(startOfCurrentWeek, i));

    const handleSlotClick = (dateStr, type) => {
        setSelectedSlot({ date: dateStr, type });
        setIsModalOpen(true);
    };

    const handleSelectMeal = (mealId) => {
        if (selectedSlot) {
            setMenuItem(selectedSlot.date, selectedSlot.type, mealId);
            setIsModalOpen(false);
        }
    };

    const handleRemoveMeal = (e) => {
        e.stopPropagation();
        if (selectedSlot) {
            setMenuItem(selectedSlot.date, selectedSlot.type, null);
            setIsModalOpen(false); // Close selection if removing? Or just remove.
        }
    }

    // Helper to render a slot
    const renderSlot = (day, type) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const mealId = menu[`${dateStr}-${type}`];
        const meal = meals.find(m => m.id === mealId);
        const dayIsPast = isPast(day) && !isToday(day);

        // Check stock
        const isOverLimit = meal && (usedCounts[meal.id] > meal.quantity);

        return (
            <div
                onClick={() => !dayIsPast && handleSlotClick(dateStr, type)}
                className={`
                    relative p-3 rounded-xl border min-h-[80px] flex flex-col justify-center items-center text-center cursor-pointer transition-all
                    ${meal ? 'bg-surface border-slate-600 shadow-sm' : 'border-dashed border-slate-700 hover:bg-slate-800/50'}
                    ${dayIsPast ? 'opacity-40 grayscale-[0.5] cursor-default bg-slate-900/20' : ''}
                    ${isToday(day) ? 'ring-1 ring-emerald-500/30' : ''}
                `}
            >
                {!meal && !dayIsPast && <PlusCircle className="text-slate-600 mb-1" size={18} />}
                {!meal && !dayIsPast && <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Planificar</span>}
                {!meal && dayIsPast && <span className="text-[10px] text-slate-600 italic">No registrado</span>}

                {meal && (
                    <>
                        <span className={`font-medium text-sm line-clamp-2 ${dayIsPast ? 'text-slate-500' : 'text-slate-100'}`}>{meal.name}</span>
                        {isOverLimit && !dayIsPast && (
                            <div className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg animate-pulse" title={`Usado ${usedCounts[meal.id]} veces, stock: ${meal.quantity}`}>
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
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
                    <div className="bg-surface w-full max-w-md h-[80vh] sm:h-auto sm:max-h-[80vh] rounded-t-2xl sm:rounded-2xl flex flex-col shadow-2xl animate-in slide-in-from-bottom-10">
                        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold text-lg">Seleccionar Comida</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-800 rounded-full"><X size={20} /></button>
                        </div>

                        <div className="p-4 overflow-y-auto flex-1 space-y-2">
                            <button onClick={() => handleSelectMeal(null)} className="w-full text-left p-3 rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800">
                                Limpiar selección
                            </button>
                            {meals.map(meal => {
                                const count = usedCounts[meal.id] || 0;
                                const available = meal.quantity;
                                const isStockLow = count >= available;

                                return (
                                    <button
                                        key={meal.id}
                                        onClick={() => handleSelectMeal(meal.id)}
                                        className="w-full text-left p-3 rounded-xl bg-slate-900/50 hover:bg-slate-800 border border-slate-700 transition-colors flex justify-between items-center"
                                    >
                                        <div>
                                            <div className="font-medium">{meal.name}</div>
                                            <div className="text-xs text-slate-400 capitalize">{meal.type === 'both' ? 'Cualquiera' : meal.type === 'lunch' ? 'Almuerzo' : 'Cena'}</div>
                                        </div>
                                        <div className="text-xs text-right">
                                            <div className={`${isStockLow ? 'text-red-400 font-bold' : 'text-green-400'}`}>
                                                Stock: {available}
                                            </div>
                                            <div className="text-slate-500">Usado: {count}</div>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
