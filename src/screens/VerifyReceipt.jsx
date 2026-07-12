// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA PÚBLICA DE VERIFICACIÓN DE COMPROBANTES
//
// Se muestra cuando la URL trae el parámetro ?verify=<saleId> (el QR de la boleta
// apunta aquí). NO requiere sesión. Consulta el endpoint público del API y muestra
// si el comprobante es auténtico, con los datos reales registrados en la base de datos.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { publicAPI } from '../utils/api.js';
import { Q, fmtD, fmtT } from '../utils/formatters.js';
import { TEAL, NAVY } from '../styles/theme.js';

var STATUS_LABEL = {
  completado: 'Pagado',
  pagado:     'Cuenta cancelada',
  parcial:    'Abono parcial',
  pendiente:  'Pendiente de pago',
  cuenta:     'Venta a crédito',
};

export default function VerifyReceipt(props) {
  var saleId = props.saleId;
  var _state = useState({ loading: true, data: null, error: '' });
  var state = _state[0]; var setState = _state[1];

  useEffect(function() {
    if (!saleId) { setState({ loading: false, data: null, error: 'No se indicó comprobante.' }); return; }
    var cancelled = false;
    publicAPI.verify(saleId)
      .then(function(res) { if (!cancelled) setState({ loading: false, data: res, error: '' }); })
      .catch(function() { if (!cancelled) setState({ loading: false, data: null, error: 'No se pudo conectar con el servidor de verificación.' }); });
    return function() { cancelled = true; };
  }, [saleId]);

  var card = { background: '#fff', borderRadius: 14, boxShadow: '0 8px 30px rgba(0,0,0,0.12)', padding: 28, maxWidth: 440, width: '100%', boxSizing: 'border-box' };
  var wrap = { minHeight: '100vh', background: '#f3f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'Arial, Helvetica, sans-serif' };
  var row  = { display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #eee', fontSize: 14 };
  var lbl  = { color: '#888', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 };
  var val  = { color: NAVY, fontWeight: 700, textAlign: 'right' };

  function Body() {
    if (state.loading) return React.createElement('div', { style: { textAlign: 'center', color: '#888', padding: '30px 0' } }, 'Verificando comprobante…');

    if (state.error) {
      return React.createElement('div', { style: { textAlign: 'center', padding: '10px 0' } },
        React.createElement('div', { style: { fontSize: 40 } }, '⚠️'),
        React.createElement('div', { style: { color: '#E24B4A', fontWeight: 700, marginTop: 8 } }, state.error),
        React.createElement('div', { style: { color: '#888', fontSize: 13, marginTop: 6 } }, 'Intenta de nuevo más tarde.')
      );
    }

    var d = state.data;
    if (!d || !d.valid) {
      return React.createElement('div', { style: { textAlign: 'center', padding: '10px 0' } },
        React.createElement('div', { style: { fontSize: 46 } }, '❌'),
        React.createElement('div', { style: { color: '#E24B4A', fontWeight: 900, fontSize: 18, marginTop: 8 } }, 'Comprobante no encontrado'),
        React.createElement('div', { style: { color: '#888', fontSize: 13, marginTop: 6 } }, 'Este folio no corresponde a ninguna venta registrada. Si recibiste esta boleta, verifica con el negocio.')
      );
    }

    var statusTxt = STATUS_LABEL[d.status] || d.status || '—';
    return React.createElement('div', null,
      React.createElement('div', { style: { textAlign: 'center', marginBottom: 16 } },
        React.createElement('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 8, background: '#EAF7F1', color: TEAL, fontWeight: 900, fontSize: 15, padding: '8px 16px', borderRadius: 30 } }, '✓ Comprobante auténtico')
      ),
      d.store_name ? React.createElement('div', { style: { textAlign: 'center', fontWeight: 900, fontSize: 18, color: NAVY, marginBottom: 14 } }, d.store_name) : null,
      React.createElement('div', { style: row }, React.createElement('span', { style: lbl }, 'Folio'), React.createElement('span', { style: Object.assign({}, val, { fontFamily: 'monospace', color: TEAL }) }, '# ' + (d.folio || ''))),
      d.client ? React.createElement('div', { style: row }, React.createElement('span', { style: lbl }, 'Cliente'), React.createElement('span', { style: val }, d.client)) : null,
      d.date ? React.createElement('div', { style: row }, React.createElement('span', { style: lbl }, 'Fecha'), React.createElement('span', { style: val }, fmtD(d.date) + ' ' + fmtT(d.date))) : null,
      React.createElement('div', { style: row }, React.createElement('span', { style: lbl }, 'Estado'), React.createElement('span', { style: val }, statusTxt)),
      React.createElement('div', { style: Object.assign({}, row, { borderBottom: 'none', marginTop: 4 }) }, React.createElement('span', { style: Object.assign({}, lbl, { fontSize: 14, color: NAVY, fontWeight: 700 }) }, 'TOTAL'), React.createElement('span', { style: Object.assign({}, val, { fontSize: 18, color: TEAL }) }, Q(d.total)))
    );
  }

  return React.createElement('div', { style: wrap },
    React.createElement('div', { style: card },
      React.createElement('div', { style: { textAlign: 'center', marginBottom: 18 } },
        React.createElement('div', { style: { fontSize: 11, color: '#aaa', textTransform: 'uppercase', letterSpacing: 2 } }, 'Verificación de comprobante')
      ),
      React.createElement(Body, null),
      React.createElement('div', { style: { textAlign: 'center', marginTop: 22, fontSize: 11, color: '#bbb' } }, 'Verificación en línea · datos tomados directamente del sistema')
    )
  );
}
