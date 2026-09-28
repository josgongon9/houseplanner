import { cents } from './commonAccount';

export function validateExpenseAllocation(expense) {
    if (!Number.isFinite(Number(expense.amount)) || cents(expense.amount) <= 0) throw new Error('El importe debe ser mayor que cero.');
    if (!expense.payerId) throw new Error('Selecciona quién pagó.');
    const destination = expense.chargeTo || 'people';
    if (!['people', 'common'].includes(destination)) throw new Error('Destino no válido.');
    if (destination === 'common' && expense.category === 'settlement') throw new Error('Una liquidación entre personas no puede estar a cargo de la CM.');
    if (!expense.splitAmong?.length) throw new Error('Selecciona para quién es el gasto.');
    if (expense.splitMode === 'custom') {
        const amounts = Object.entries(expense.customAmounts || {});
        if (amounts.some(([, value]) => !Number.isFinite(Number(value)) || Number(value) < 0) ||
            amounts.reduce((total, [, value]) => total + cents(value), 0) !== cents(expense.amount) ||
            amounts.some(([id, value]) => cents(value) > 0 && !expense.splitAmong.includes(id))) {
            throw new Error('El reparto debe sumar exactamente el importe del gasto.');
        }
    }
}

export function expenseAllocation({ chargeTo, splitMode, splitAmong, customAmounts }, members) {
    if (chargeTo === 'common') return { chargeTo, splitMode: 'equal', splitAmong: members.map(member => member.id), customAmounts: {} };
    return {
        chargeTo: 'people', splitMode,
        splitAmong: splitMode === 'custom' ? Object.keys(customAmounts).filter(id => Number(customAmounts[id]) > 0) : splitAmong,
        customAmounts: splitMode === 'custom' ? customAmounts : {}
    };
}
