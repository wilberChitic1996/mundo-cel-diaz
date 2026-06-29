# Checklist de Smoke Test — PraxisGT / Mundo Cel Diaz

> Prueba rápida para validar **en pantalla** que un release no rompió nada. Pensada para correr
> en el **sandbox de producción** (TechStore Demo GT, datos falsos) después de cada salida a `main`.
> Para no programadores: cada paso dice **qué hacer** y **qué deberías ver**.

---

## Antes de empezar

- **Ambiente:** `mundoceldiaz.com` (producción)
- **Negocio de prueba:** **TechStore Demo GT** — datos falsos, propio para probar
- **Usuario:** `admin@techstore.gt`
- **Clave:** `Guatemala2`

> ⚠️ **Usá SOLO TechStore Demo GT.** Los demás negocios en producción son reales — **no tocar**.
> Marcá ✅ lo que pase y ❌ lo que se vea raro. Si algo falla, anotá **qué hiciste** y **qué viste** (o una foto).

---

## Parte 1 — Núcleo de comprobantes y caja (Grupo E)

### 1. Venta normal — la boleta NO debe haber cambiado
- [ ] Hacer una venta en el **POS** y cobrarla.
- [ ] Aparece el cuadro de siempre: **Imprimir/PDF · Descargar imagen · WhatsApp**.
- [ ] La boleta muestra: datos del negocio correctos, **QR**, y desglose **Subtotal / IVA 12% / Total**.

### 2. Abono a una cuenta — debe ofrecer comprobante
- [ ] **Cuentas por cobrar** → abrir una cuenta con saldo → registrar un **abono**.
- [ ] Se abre el comprobante con título **"Abono registrado"** (Imprimir/PDF/imagen/WhatsApp).
- [ ] Dice **"Comprobante de Abono"** y muestra **abono de hoy / pagado / saldo**.

### 3. Devolución — debe ofrecer comprobante
- [ ] **Devoluciones** → procesar una devolución de una venta.
- [ ] Se abre el comprobante con título **"Devolución registrada"** y un **banner DEVOLUCIÓN**.

### 4. Cierre de caja — respaldo automático
- [ ] Abrir caja (fondo inicial) → hacer un par de movimientos → **cerrar caja**.
- [ ] Cierra normal y muestra el **arqueo** (ventas / efectivo / diferencia).
- [ ] **Backup** → en el historial **aparece un respaldo nuevo** (se dispara solo al cerrar).

### 5. Notificaciones push — opcional (mejor esfuerzo)
- [ ] Si el navegador/celular pide **permiso de notificaciones**, aceptar.
- [ ] Basta con que **no rompa nada** al cargar. Las notificaciones reales llegan con los recordatorios automáticos.

---

## Parte 2 — Regresión rápida (que lo de siempre siga bien)

- [ ] **Login y menú:** entra bien y se ven solo los módulos del rol.
- [ ] **Exportar:** en **Historial** o **Cuadres**, probar **Excel** y **PDF** → descargan bien.
- [ ] **Productos:** crear/editar un producto y que la lista se actualice al instante.
- [ ] **Compra a proveedor:** registrar una compra → el **stock sube**.
- [ ] **Reparación:** crear una orden y cobrarla → genera boleta.
- [ ] **QR de boleta:** escanear el QR de una boleta → abre la página de verificación pública.

---

## Si algo falla
Reportar: **(1)** qué módulo, **(2)** qué se hizo, **(3)** qué se vio (mensaje de error o foto).
El arreglo va bajo el protocolo de siempre: rama → `staging` → producción, cuidando lo que ya funciona.

---

## Cobertura por release (referencia)
Este checklist cubre el **Grupo E** (comprobantes/caja/push) y la **regresión núcleo**. Para la lista
completa de funciones núcleo a verificar en cada salida, ver también la regla de regresión del proyecto.
