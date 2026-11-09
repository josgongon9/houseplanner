# Casa

Módulo opcional en `/house`, activado por usuario desde Perfil con `users/{uid}.houseEnabled`. Desactivarlo oculta el acceso y conserva los datos. El inventario, los pagos, las aportaciones y los objetivos pertenecen al hogar activo.

## Datos y aislamiento

Se guardan en `households/{id}.houseModule`, en las secciones `items`, `payments`, `savings` y `goals`. Las escrituras usan transacciones y versiones por registro para evitar sobrescribir ediciones de otros miembros. El contexto general excluye este campo para que sus cambios no reinicien los efectos de comidas y gastos. Se mantienen las reglas de acceso existentes del documento del hogar; no se modifican reglas ni se crean movimientos en Gastos o Finanzas.

## Inventario

- Estados: pendiente, regalo, comprado y ya se tenía. Los regalos solo están disponibles cuando se marcan como recibidos.
- Categorías libres con sugerencias, búsqueda y filtros por estado o disponibilidad.
- Los importes vacíos no cuentan; cero es un precio válido. Se almacenan céntimos enteros.
- Los totales corresponden a la selección filtrada. La desviación compara únicamente comprados con ambos precios registrados.
- El coste por comprar excluye regalos. Los precios introducidos en regalos sí aparecen en los totales estimado/real.
- Los nombres se comparan sin mayúsculas, acentos ni espacios sobrantes. Para dos objetos distintos del mismo tipo, se puede indicar la ubicación en el nombre.

## Pagos y ahorro

- Entrada, mensualidades, extraordinarios y entrega final. Las mensualidades se generan entre dos meses inclusivos, hasta 600 cuotas; los días 29–31 se ajustan al último día del mes cuando corresponde.
- Cada pago tiene vencimiento e importe. Una fecha de pago lo marca como realizado; vaciarla lo devuelve a pendiente. No se realizan transferencias bancarias.
- Registrar el saldo inicial como aportación y después las aportaciones o retiradas. Saldo disponible = aportaciones hasta hoy menos pagos de vivienda realizados. Las compras del inventario se mantienen aparte.
- La previsión descuenta del saldo actual los pagos pendientes con vencimiento hasta la fecha elegida, incluidos los vencidos. No presupone futuras aportaciones.
- Cada objetivo expresa el saldo que se desea conservar después de esos pagos. Los objetivos son hitos independientes, no cantidades que se suman entre sí.

## Verificación

`npm test -- --run` ejecuta la suite. Los tests específicos están en `src/lib/house.test.js`, `src/hooks/useHouse.test.js` y `src/pages/House.test.jsx`: cálculos, duplicados, versiones concurrentes, aislamiento de escrituras, mensualidades, cambio de hogar y flujos de formularios.

`npm run build` genera producción. El comando de lint del repositorio requiere una configuración de ESLint, actualmente ausente.
