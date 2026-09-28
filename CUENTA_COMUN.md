# Anticipos a cargo de la cuenta común

Al crear o editar un gasto, «Pagado por» identifica a quien adelantó el dinero. «A cargo de» permite elegir Personas (reparto y liquidación existentes) o Cuenta común (reembolso íntegro al pagador). Los gastos recurrentes conservan esta elección. Para estadísticas, los anticipos de la CM se reparten por igual entre los miembros del hogar registrados en el gasto.

En Saldos, la CM tiene el mismo formato mensual que los saldos entre personas: un saldo por miembro y una tarjeta «CM paga a …» con «Marcar como pagado». Se usa el mes seleccionado, sin listado de gastos. Los pendientes de otros meses se conservan y se consultan navegando a ese mes. Ambos tipos de deuda nunca se compensan entre sí.

Una liquidación mensual salda todos los anticipos pendientes de esa persona en el mes, en una única transacción y con la fecha real del pago. El historial agrupa la liquidación y permite anularla completa. Los reembolsos parciales registrados anteriormente siguen descontándose del saldo. Registrar el reembolso solo actualiza HousePlanner: la transferencia se hace en el banco. No se registran aportaciones ni se calcula el saldo bancario de la CM.

En la importación BBVA, tanto en la revisión como en movimientos ya importados, selecciona «Reembolso CM (no es gasto)» para las transferencias de devolución. Se conservan en el informe, pero quedan fuera de los totales y gráficas de consumo. Esta clasificación no liquida anticipos automáticamente: el reembolso se registra en Saldos. No se infieren transferencias a partir del concepto bancario.

## Datos y compatibilidad

Al editar un gasto pendiente se recalculan los saldos del mes. Si pasa de Personas a CM, las liquidaciones personales ya realizadas se conservan: pueden dejar un saldo a devolver entre personas. No se borran transferencias previas. Si el gasto tiene reembolsos de la CM, hay que anularlos antes de cambiar de destino o pagador. Aumentar su importe mantiene lo ya devuelto y deja pendiente solo la diferencia.

Cambiar una regla recurrente afecta a los gastos que se generen después; no modifica gastos mensuales ya creados ni sus liquidaciones. Para corregir un gasto ya generado, editarlo desde el listado. El reparto personalizado se puede editar tanto en gastos como en reglas y debe cuadrar al céntimo.

- Los gastos y reglas nuevos guardan `chargeTo: people | common`. Su ausencia equivale al comportamiento histórico entre personas; no requiere migración.
- Los gastos CM guardan `reimbursements` con identificador, importe en céntimos, fecha y autor. Las escrituras son transacciones sobre el gasto y comprueban el hogar y el pendiente actualizado. Reintentar el mismo reembolso no lo duplica.
- Un gasto con reembolsos no puede eliminarse, cambiar de pagador/destino ni reducirse por debajo del importe ya devuelto sin anular primero esos reembolsos.
- La categoría reservada `cm_reimbursement` excluye transferencias importadas del consumo sin modificar las deudas entre personas.
- Se usan las colecciones existentes de gastos, reglas e importaciones, sujetas a las reglas de acceso de Firebase del proyecto.

## Comprobación manual

1. Registrar 60 € pagados por A, a cargo exclusivamente de B.
2. Registrar 80 € pagados por B, a cargo de la CM.
3. En Saldos comprobar B → A: 60 € y CM → B: 80 €, sin compensación entre ambos.
4. Marcar como pagado el saldo de B en la CM: queda a cero. Anular la liquidación: vuelven a quedar 80 €.
5. Cambiar el mes: aparecen los saldos de ese mes. Volver al anterior: su pendiente se conserva.
6. Clasificar su devolución importada como Reembolso CM: no aumenta el consumo.
