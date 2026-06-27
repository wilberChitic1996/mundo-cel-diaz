// ══════════════════════════════════════════════════════════════════════════════
// UTILIDAD: export.js
//
// Funciones para exportar datos a Excel (.xlsx) y PDF.
// Usadas por InventoryScreen, CuadresScreen, AccountsScreen, etc.
//
// Dependencias externas:
//   - XLSX (SheetJS): disponible como global `window.XLSX` (cargado por el HTML)
//   - jspdf + jspdf-autotable: importados dinámicamente solo cuando se necesitan
//     (así no aumentan el bundle inicial de la app)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Exporta filas a un archivo Excel (.xlsx) y lo descarga en el navegador.
 *
 * @param {Array[]}  rows     — arreglo de arreglos con los valores de cada fila
 * @param {string[]} cols     — arreglo con los encabezados de columna
 * @param {string}   filename — nombre del archivo (sin extensión)
 */
import * as XLSX from 'xlsx';

export async function exportExcel(rows, cols, filename) {
  var ws = XLSX.utils.aoa_to_sheet([cols].concat(rows));
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
  XLSX.writeFile(wb, filename + '.xlsx');
}

/**
 * Genera y descarga un PDF con los datos proporcionados.
 * Usa orientación horizontal si hay más de 6 columnas.
 *
 * @param {string}   title    — título que aparece en la parte superior del PDF
 * @param {string[]} cols     — encabezados de columna
 * @param {Array[]}  rows     — filas de datos
 * @param {string}   filename — nombre del archivo (sin extensión)
 */
export async function exportPDF(title, cols, rows, filename) {
  var jsPDF     = (await import('jspdf')).jsPDF;
  var autoTable = (await import('jspdf-autotable')).default;
  var doc = new jsPDF({ orientation: rows[0] && rows[0].length > 6 ? 'landscape' : 'portrait' });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.text('Generado: ' + new Date().toLocaleString('es-GT'), 14, 23);
  autoTable(doc, {
    head:       [cols],
    body:       rows,
    startY:     28,
    styles:     { fontSize: 8 },
    headStyles: { fillColor: [29, 158, 117] },
  });
  doc.save(filename + '.pdf');
}
