// utils/qr.js
// Genera un QR como data URL (imagen) DENTRO de la app, con una librería local
// (qrcode-generator) — sin CDN y sin scripts inline. Así el QR funciona dentro de
// las ventanas de boleta bajo la CSP estricta (script-src 'self').
import qrcode from 'qrcode-generator';

export function qrDataUrl(text) {
  try {
    var qr = qrcode(0, 'M');           // tipo auto, corrección de errores media
    qr.addData(String(text == null ? '' : text));
    qr.make();
    return qr.createDataURL(4, 0);     // data:image/gif;base64,... (el <img> lo escala)
  } catch (e) {
    return '';
  }
}
