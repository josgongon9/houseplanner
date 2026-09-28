import { format, parseISO } from 'date-fns';

export const isCommonExpense = expense => expense.chargeTo === 'common' && expense.category !== 'settlement';
export const expenseDay = expense => format(parseISO(expense.date), 'yyyy-MM-dd');
export const cents = value => Math.round(Number(value) * 100);
export const reimbursedCents = expense => (expense.reimbursements || []).reduce((sum, item) => sum + item.amountCents, 0);
export const pendingCents = expense => isCommonExpense(expense) ? Math.max(0, cents(expense.amount) - reimbursedCents(expense)) : 0;

export function appendReimbursement(expense, reimbursement) {
    if ((expense.reimbursements || []).some(item => item.id === reimbursement.id)) return expense.reimbursements;
    if (!isCommonExpense(expense)) throw new Error('Este gasto no está a cargo de la CM.');
    if (!Number.isSafeInteger(reimbursement.amountCents) || reimbursement.amountCents <= 0 || reimbursement.amountCents > pendingCents(expense)) {
        throw new Error('El importe debe ser mayor que cero y no superar el pendiente.');
    }
    const parsed = new Date(reimbursement.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reimbursement.date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== reimbursement.date) throw new Error('Fecha no válida.');
    if (reimbursement.date < expenseDay(expense)) throw new Error('El reembolso no puede ser anterior al gasto.');
    if (reimbursement.date > format(new Date(), 'yyyy-MM-dd')) throw new Error('El reembolso no puede tener una fecha futura.');
    return [...(expense.reimbursements || []), reimbursement];
}

export function validateReimbursedEdit(expense, changes) {
    if (!reimbursedCents(expense)) return;
    const next = { ...expense, ...changes };
    if (!isCommonExpense(next) || next.payerId !== expense.payerId || cents(next.amount) < reimbursedCents(expense) || next.date !== expense.date) {
        throw new Error('Anula los reembolsos antes de cambiar el pagador, el destino o reducir el importe reembolsado.');
    }
}
