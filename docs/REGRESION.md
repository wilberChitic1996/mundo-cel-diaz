# Checklist de regresión — PraxisGT / Mundo Cel Diaz

> **Regla crítica.** En **cada** cambio o release, además de probar lo nuevo, hay que
> hacer **pruebas de regresión en paralelo**: validar que lo que **ya funcionaba sigue
> funcional**, aunque no sea el objeto del cambio. Un cambio puede romper algo no
> relacionado (CSP, refactors, dependencias). Si algo de este checklist falla, **se para
> el release**.

**Cuándo correrlo:** en el piloto (`staging`) antes de cada PR `staging → main`, en
paralelo a la prueba del cambio. Marcá lo que aplique; lo crítico siempre. Mantené este
documento actualizado cuando aparezcan funciones nuevas.

**Quién:** rol QA, idealmente vía navegador (Playwright) sobre
`https://mundo-cel-diaz-staging.vercel.app`.

---

## Boleta de VENTA (sensible a la CSP estricta — A11)

- [ ] **QR de verificación** renderiza como **imagen** (no CDN; usa `utils/qr.js` /
      `qrcode-generator`). Verificar que la imagen tenga datos reales (no rota).
- [ ] **IVA desglosado** visible: `Subtotal (sin IVA)` + `IVA (X%)` + `TOTAL (IVA incl.)`
      cuando `iva_percent > 0` (Guatemala: precio con IVA incluido → desglose hacia atrás).
- [ ] **Imprimir / PDF / Descargar PNG / WhatsApp** funcionan.
- [ ] El comprobante de **COMPRA** **NO** lleva QR (es documento interno de inventario,
      por diseño no tributario). El QR es solo de la boleta de **venta**.

## Flujos núcleo

- [ ] **Login** admin y cajero; expiración de sesión; **RBAC** (el cajero no ve accesos de admin).
- [ ] **POS:** venta contado / crédito / abono; descuento; métodos de pago; descuento de stock.
- [ ] **Historial:** detalle de venta con desglose de IVA.
- [ ] **Cuentas por cobrar:** aging (no crashea al filtrar por balde de antigüedad), abonos, recordatorios.
- [ ] **Reparaciones:** orden, cambios de estado, cobro por POS (genera boleta).
- [ ] **Compras / Proveedores:** registrar compra con y sin factura; crédito fiscal
      (NIT / N° factura / IVA crédito calculado); comprobante de compra.
- [ ] **Cuadres:** totales por método, ganancia, IVA débito/crédito, export Excel/PDF.

## Transversal

- [ ] **Multi-tenant:** cada negocio solo ve su data (probar idealmente con ≥2 negocios).
- [ ] **Refresco de listas** tras crear/editar.
- [ ] Sin errores en consola que tumben la vista (ErrorBoundary).

---

*Fuente de verdad del proyecto: `CLAUDE.md` (raíz del repo frontend). Este checklist
también se mantiene como memoria de la sesión de Claude para tenerlo siempre a mano.*
