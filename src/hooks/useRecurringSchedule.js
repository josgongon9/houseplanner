import { useEffect } from 'react';
import { recurringMonthKey } from '../lib/recurringExpenses';

export default function useRecurringSchedule(generate, enabled, rules) {
    useEffect(() => {
        if (!enabled) return;
        let completedMonth = '';
        let busy = false;
        let disposed = false;
        const check = async () => {
            const now = new Date();
            const month = recurringMonthKey(now);
            if (disposed || busy || completedMonth === month) return;
            busy = true;
            try {
                await generate(now);
                completedMonth = month;
            } catch (error) {
                // Retry on the next tick/focus after transient network failures.
                console.error('No se pudieron generar los gastos recurrentes.', error);
            } finally { busy = false; }
        };
        const onVisible = () => { if (document.visibilityState === 'visible') check(); };
        check();
        const timer = window.setInterval(check, 60000);
        window.addEventListener('focus', check);
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            disposed = true;
            window.clearInterval(timer);
            window.removeEventListener('focus', check);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [generate, enabled, rules]);
}
