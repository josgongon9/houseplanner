# Importación BBVA

Disponible en Gastos → Cuenta común en pantallas de al menos 1024 px. Los movimientos importados se agregan a totales mensuales, anuales y gráficos de categorías y casa. En el gráfico por persona aparecen como Cuenta común, sin asignarse a ninguna persona. Listado, reparto manual, liquidaciones y saldos usan exclusivamente los gastos manuales.

Se lee la tabla detallada identificada por Fecha, Categoría, Subcategoría, Importe y Concepto; nunca el resumen. Se importan todos los importes negativos (incluidas autotransferencias, Bizum y retiradas), como importes positivos en la app. Los ingresos, abonos y ceros se excluyen. Las fechas se conservan para imputar cada movimiento a su mes.

Categorías: Bares y restaurantes → Restaurante(s); Alimentación → Supermercado(s). Después se busca la categoría, luego subcategoría, entre las categorías actuales del hogar, ignorando tildes y mayúsculas; finalmente Otro. No se crean categorías. La categoría puede corregirse en la revisión previa.

El XLSX se procesa en el navegador; no se almacena el fichero original. Los movimientos se guardan en `households/{householdId}/bankExpenseImports/{sha256}`. Cada documento contiene el nombre del fichero, fecha y autor de importación y una lista de movimientos. No contiene pagador, beneficiarios ni división. Cada alta y borrado es atómico. Máximo: 10 MB de XLSX, 3000 movimientos y 700 KB de datos por informe; para informes mayores se solicita reducir el periodo.

Un informe con los mismos movimientos no se puede importar dos veces, aunque cambie de nombre, orden o categorías. Los cargos repetidos dentro del mismo informe se conservan. Si otro informe contiene movimientos con la misma fecha, concepto e importe, se exige aceptar explícitamente su inclusión de nuevo. No se deduplican cargos manuales. El borrado elimina el informe completo, incluidos todos sus meses, y permite volver a importarlo.

## Acceso en Firebase

No hay reglas de Firestore ni configuración de despliegue de Firebase versionadas en este proyecto. Antes de usar la funcionalidad en producción, integrar el siguiente bloque dentro del `match /databases/{database}/documents` de las reglas existentes. No sustituir las reglas actuales ni desplegar un archivo que contenga solamente este bloque. Las reglas del documento padre no autorizan automáticamente sus subcolecciones.

```text
match /households/{householdId}/bankExpenseImports/{importId} {
  function bankImportMember() {
    return request.auth != null
      && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.householdId == householdId;
  }
  allow read, delete: if bankImportMember();
  allow create: if bankImportMember()
    && request.resource.data.keys().hasOnly(['fileName', 'entries', 'createdBy', 'createdAt'])
    && request.resource.data.createdBy == request.auth.uid
    && request.resource.data.fileName is string
    && request.resource.data.createdAt is string
    && request.resource.data.entries is list
    && request.resource.data.entries.size() > 0
    && request.resource.data.entries.size() <= 3000;
  allow update: if false;
}
```

Verificar con un miembro del hogar la lectura, creación y borrado, y denegar acceso a usuarios de otro hogar. Un error de permisos se muestra en la pestaña y no afecta a las operaciones manuales. No se ha modificado ni desplegado ninguna regla remota.
