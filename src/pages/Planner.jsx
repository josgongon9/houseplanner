import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
// import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay } from 'date-fns';
// Note: importing from date-fns directly doesn't work well in some ESM envs without specific paths if not configured, 
// but standard vite setup handles 'date-fns'. 
// I'll assume standard import works.
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, AlertTriangle, PlusCircle, X } from 'lucide-react';

export default function Planner() {
    const { meals, menu, setMenuItem, logout, household } = useStore();
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

        // Check stock
        const isOverLimit = meal && (usedCounts[meal.id] > meal.quantity);

        return (
            <div
                onClick={() => handleSlotClick(dateStr, type)}
                className={`
            relative p-3 rounded-xl border border-dashed border-slate-700 min-h-[80px] flex flex-col justify-center items-center text-center cursor-pointer transition-colors
            ${meal ? 'bg-surface border-solid border-slate-600' : 'hover:bg-slate-800/50'}
        `}
            >
                {!meal && <PlusCircle className="text-slate-600 mb-1" size={20} />}
                {!meal && <span className="text-xs text-slate-500">Añadir</span>}

                {meal && (
                    <>
                        <span className="font-medium text-sm line-clamp-2">{meal.name}</span>
                        {isOverLimit && (
                            <div className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg animate-pulse" title={`Usado ${usedCounts[meal.id]} veces, stock: ${meal.quantity}`}>
                                <AlertTriangle size={12} />
                            </div>
                        )}
                        {/* Remove button (small x) */}
                        {/* We can handle remove by opening modal and selecting 'None' or clicking X here... logic inside modal is cleaner for mobile */}
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="pb-24">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md p-4 border-b border-white/5">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentDate(subWeeks(currentDate, 1))} className="p-2 hover:bg-white/5 rounded-full"><ChevronLeft /></button>
                        <h2 className="text-lg font-bold capitalize">
                            {format(startOfCurrentWeek, 'MMMM', { locale: es })}
                        </h2>
                        <button onClick={() => setCurrentDate(addWeeks(currentDate, 1))} className="p-2 hover:bg-white/5 rounded-full"><ChevronRight /></button>
                    </div>
                    <button onClick={logout} className="text-xs text-slate-400 hover:text-white border border-slate-700 px-3 py-1 rounded-full transition-colors">Salir</button>
                </div>
                {household && (
                    <div className="flex justify-center items-center gap-2 mb-2">
                        <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full border border-primary/30 flex items-center gap-1">
                            {household.name} • {household.code}
                        </span>
                    </div>
                )}
                <div className="text-xs text-center text-slate-400">
                    Del {format(startOfCurrentWeek, 'd')} al {format(addDays(startOfCurrentWeek, 6), 'd MMM')}
                </div>
            </div>

            {/* Grid */}
            <div className="p-4 space-y-6">
                {days.map(day => (
                    <div key={day.toString()} className="animate-in fade-in duration-500">
                        <h3 className="font-bold text-lg mb-2 capitalize text-slate-300">
                            {format(day, 'EEEE d', { locale: es })}
                        </h3>
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
                ))}
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
