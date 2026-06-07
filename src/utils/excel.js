import * as XLSX from 'xlsx'
import { Q, fmtD, fmtT } from './formatters.js'

/**
 * Exporta todos los datos del sistema a un archivo Excel (.xlsx)
 * con 7 hojas bien estructuradas. Solo incluye datos reales.
 *
 * @param {object} data - { products, sales, accounts, returns }
 */
export function exportToExcel({ products, sales, accounts, returns }) {
  const wb  = XLSX.utils.book_new()
  const now = new Date()

  // ── Hoja 1: Resumen general ──────────────────────────
  const pendAcc    = accounts.filter(a => a.status !== 'pagado')
  const totalPend  = pendAcc.reduce((s, a) => s + a.balance, 0)
  const totalVentas = sales.reduce((s, x) => s + x.total, 0)
  const wsResumen  = XLSX.utils.aoa_to_sheet([
    ['MUNDO CEL DIAZ — Reporte General'],
    ['Generado el:', `${fmtD(now)} a las ${fmtT(now)}`],
    [],
    ['VENTAS'],
    ['Total ventas registradas',        sales.length],
    ['Ingresos totales (Q)',            totalVentas],
    ['Ventas de hoy',                   sales.filter(s => new Date(s.date).toDateString() === now.toDateString()).length],
    [],
    ['CUENTAS POR COBRAR'],
    ['Cuentas activas',                 pendAcc.length],
    ['Total pendiente (Q)',             totalPend],
    ['Total cobrado en cuentas (Q)',    accounts.reduce((s, a) => s + a.paid, 0)],
    [],
    ['INVENTARIO'],
    ['Total productos',                 products.filter(p => p.unit !== 'serv').length],
    ['Productos sin stock',             products.filter(p => p.stock === 0 && p.unit !== 'serv').length],
    ['Productos con stock bajo (< 5)',  products.filter(p => p.stock > 0 && p.stock < 5 && p.unit !== 'serv').length],
    [],
    ['DEVOLUCIONES'],
    ['Total devoluciones',              returns.length],
    ['Valor total devuelto (Q)',        returns.reduce((s, r) => s + r.total, 0)],
  ])
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  // ── Hoja 2: Ventas ───────────────────────────────────
  const wsVentas = XLSX.utils.aoa_to_sheet([
    ['ID Venta', 'Fecha', 'Hora', 'Cliente', 'Método de Pago', 'N° Artículos', 'Total (Q)'],
    ...sales.map(s => [
      s.id, fmtD(s.date), fmtT(s.date),
      s.client || 'Cliente general', s.method,
      s.items.reduce((n, i) => n + i.qty, 0),
      s.total,
    ]),
  ])
  XLSX.utils.book_append_sheet(wb, wsVentas, 'Ventas')

  // ── Hoja 3: Detalle de ventas (una línea por producto) ──
  const wsDetalle = XLSX.utils.aoa_to_sheet([
    ['ID Venta', 'Fecha', 'Cliente', 'Código', 'Producto', 'Estantería', 'Cantidad', 'Precio Unit. (Q)', 'Subtotal (Q)'],
    ...sales.flatMap(s => s.items.map(it => [
      s.id, fmtD(s.date), s.client || 'Cliente general',
      it.code, it.name, it.shelf || '',
      it.qty, it.price, it.price * it.qty,
    ])),
  ])
  XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle Ventas')

  // ── Hoja 4: Cuentas por cobrar ───────────────────────
  const wsCuentas = XLSX.utils.aoa_to_sheet([
    ['ID', 'Fecha', 'Cliente', 'Total (Q)', 'Pagado (Q)', 'Saldo (Q)', 'Estado', 'N° Pagos'],
    ...accounts.map(a => [
      a.id, fmtD(a.date), a.client,
      a.total, a.paid, a.balance,
      a.status === 'pagado' ? '✓ Pagado' : a.status === 'parcial' ? 'Abono parcial' : 'Pendiente',
      (a.payments || []).length,
    ]),
  ])
  XLSX.utils.book_append_sheet(wb, wsCuentas, 'Cuentas por Cobrar')

  // ── Hoja 5: Historial de pagos ───────────────────────
  const allPayments = []
  accounts.forEach(a => (a.payments || []).forEach(p => allPayments.push([
    a.id, a.client, fmtD(p.date), fmtT(p.date),
    p.amount, p.method, p.note || '',
  ])))
  const wsPagos = XLSX.utils.aoa_to_sheet([
    ['ID Cuenta', 'Cliente', 'Fecha', 'Hora', 'Monto (Q)', 'Método', 'Nota'],
    ...allPayments,
  ])
  XLSX.utils.book_append_sheet(wb, wsPagos, 'Historial Pagos')

  // ── Hoja 6: Devoluciones ─────────────────────────────
  const wsDev = XLSX.utils.aoa_to_sheet([
    ['ID', 'Fecha', 'Hora', 'Cliente', 'Motivo', 'Método Reembolso', 'Valor (Q)', 'Productos devueltos'],
    ...returns.map(r => [
      r.id, fmtD(r.date), fmtT(r.date), r.client,
      r.reason, r.refundMethod, r.total,
      r.items.map(i => `${i.qty}x ${i.name}`).join(' | '),
    ]),
  ])
  XLSX.utils.book_append_sheet(wb, wsDev, 'Devoluciones')

  // ── Hoja 7: Inventario completo ──────────────────────
  const wsInv = XLSX.utils.aoa_to_sheet([
    ['Código', 'Nombre', 'Categoría', 'Estantería', 'Unidad', 'Stock', 'Precio Venta (Q)', 'Costo (Q)', 'Margen (%)', 'Estado'],
    ...[...products]
      .sort((a, b) => a.code.localeCompare(b.code))
      .map(p => {
        const mg = p.cost > 0 ? Math.round((p.price - p.cost) / p.price * 100) : 'N/A'
        const st = p.unit === 'serv' ? 'Servicio' : p.stock === 0 ? 'Sin stock' : p.stock < 5 ? 'Stock bajo' : 'OK'
        return [p.code, p.name, p.category, p.shelf, p.unit, p.unit === 'serv' ? 'N/A' : p.stock, p.price, p.cost || 0, mg, st]
      }),
  ])
  XLSX.utils.book_append_sheet(wb, wsInv, 'Inventario')

  // ── Guardar el archivo ───────────────────────────────
  const filename = `MundoCelDiaz_${now.toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, filename)
  return filename
}
