const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Variables de entorno privadas leídas desde Render
const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Citas';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de verificación de variables
app.use('/api', (req, res, next) => {
  if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
    return res.status(500).json({ 
      error: 'Variables de entorno no configuradas en Render. Define AIRTABLE_PAT y AIRTABLE_BASE_ID en Environment.' 
    });
  }
  next();
});

// Obtener todas las citas
// Función auxiliar para leer cualquier tabla de Airtable
async function fetchTableRecords(tableName) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`;
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.records || [];
  } catch (e) {
    console.error(`Error consultando tabla ${tableName}:`, e);
    return [];
  }
}

// 1. OBTENER Y ENRIQUECER TODAS LAS CITAS (GET /api/citas)
app.get('/api/citas', async (req, res) => {
  try {
    // Consultar en paralelo las 3 tablas: Citas, Clientes y Tecnicos
    const [citasRecords, clientesRecords, tecnicosRecords] = await Promise.all([
      fetchTableRecords(AIRTABLE_TABLE_NAME),
      fetchTableRecords('Clientes'),
      fetchTableRecords('Tecnicos')
    ]);

    // Crear mapa de Clientes por recId: { id -> { nombre, telefono } }
    const clientesMap = {};
    clientesRecords.forEach(c => {
      const f = c.fields || {};
      clientesMap[c.id] = {
        nombre: f['Nombre'] || f['Cliente'] || f['Name'] || '',
        telefono: f['Telefono'] || f['Teléfono'] || f['Phone'] || f['Celular'] || ''
      };
    });

    // Crear mapa de Técnicos por recId: { id -> { nombre } }
    const tecnicosMap = {};
    tecnicosRecords.forEach(t => {
      const f = t.fields || {};
      tecnicosMap[t.id] = {
        nombre: f['Nombre'] || f['Tecnico'] || f['Técnico'] || f['Name'] || ''
      };
    });

    // Enriquecer cada cita resolviendo los nombres reales
    const enrichedRecords = citasRecords.map(cita => {
      const fields = { ...cita.fields };

      // Resolver Cliente y Teléfono
      if (Array.isArray(fields['Cliente']) && fields['Cliente'].length > 0) {
        const clienteId = fields['Cliente'][0];
        if (clientesMap[clienteId]) {
          fields['Cliente_Nombre'] = clientesMap[clienteId].nombre;
          fields['Cliente_Telefono'] = clientesMap[clienteId].telefono;
        }
      }

      // Resolver Técnico
      if (Array.isArray(fields['Tecnico']) && fields['Tecnico'].length > 0) {
        const tecnicoId = fields['Tecnico'][0];
        if (tecnicosMap[tecnicoId]) {
          fields['Tecnico_Nombre'] = tecnicosMap[tecnicoId].nombre;
        }
      }

      return {
        id: cita.id,
        createdTime: cita.createdTime,
        fields
      };
    });

    res.json({ records: enrichedRecords });
  } catch (error) {
    console.error('Error al enriquecer citas:', error);
    res.status(500).json({ error: 'Error al consultar Airtable' });
  }
});

// Actualizar estado de cita
app.patch('/api/citas/:id', async (req, res) => {
  const { id } = req.params;
  const { fields } = req.body;

  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}/${id}`;
  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error al actualizar cita en Airtable:', error);
    res.status(500).json({ error: 'Error interno al actualizar la cita' });
  }
});

// Servir la página principal
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor seguro corriendo en el puerto ${PORT}`);
});
