import React, { useState } from 'react'
import { sCard, sInput, sLabel, mkBtn, TEAL } from '../styles/theme.js'

const FIELDS = [
  { key: 'code',     label: 'Código',           placeholder: 'A001',             type: 'text'   },
  { key: 'name',     label: 'Nombre',            placeholder: 'Ej: Pantalla...', type: 'text'   },
  { key: 'category', label: 'Categoría',         placeholder: 'Pantallas',        type: 'text'   },
  { key: 'shelf',    label: 'Estantería',         placeholder: 'A-01',             type: 'text'   },
  { key: 'price',    label: 'Precio venta (Q)',   placeholder: '0.00',             type: 'number' },
  { key: 'cost',     label: 'Costo (Q)',          placeholder: '0.00',             type: 'number' },
  { key: 'stock',    label: 'Stock',              placeholder: '0',                type: 'number' },
  { key: 'unit',     label: 'Unidad',             placeholder: 'uni / serv',       type: 'text'   },
]

export default function ProductForm({ product, onSave, onCancel }) {
  const [form, setForm] = useState({ ...product })
  const [error, setError] = useState('')

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  const handleSave = () => {
    if (!form.code?.trim() || !form.name?.trim()) {
      setError('Código y Nombre son obligatorios')
      return
    }
    onSave({
      ...form,
      price: parseFloat(form.price) || 0,
      cost:  parseFloat(form.cost)  || 0,
      stock: parseInt(form.stock)   || 0,
    })
  }

  return (
    <div style={{ ...sCard, marginBottom: 16, borderColor: TEAL, borderWidth: '1.5px' }}>
      <p style={{ fontWeight: 600, margin: '0 0 14px', fontSize: 15 }}>
        {product.id ? '✏️ Editar Producto' : '➕ Nuevo Producto'}
      </p>

      {error && (
        <p style={{ color: '#E24B4A', fontSize: 13, margin: '0 0 10px' }}>⚠ {error}</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
        {FIELDS.map(f => (
          <div key={f.key}>
            <label style={sLabel}>{f.label}</label>
            <input
              type={f.type}
              style={sInput}
              value={form[f.key] ?? ''}
              placeholder={f.placeholder}
              onChange={e => { setError(''); set(f.key, e.target.value) }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button style={mkBtn('teal')} onClick={handleSave}>
          {product.id ? 'Guardar cambios' : 'Agregar producto'}
        </button>
        <button style={mkBtn('gray')} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
