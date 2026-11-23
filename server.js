const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Variables de entorno de Render
const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Citas';

app.use(cors());
app.use(express.json());

// Servir archivos estáticos desde /public y desde la raíz
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname)));

// Middleware de verificación de variables
app.use('/api', (req, res, next) => {
  if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
    return res.status(500).json({ 
      error: 'Variables de entorno no configuradas en Render. Define AIRTABLE_PAT y AIRTABLE_BASE_ID en Environment.' 
    });
  }
  next();
});

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
    const [citasRecords, clientesRecords, tecnicosRecords] = await Promise.all([
      fetchTableRecords(AIRTABLE_TABLE_NAME),
      fetchTableRecords('Clientes'),
      fetchTableRecords('Tecnicos')
    ]);

    const clientesMap = {};
    clientesRecords.forEach(c => {
      const f = c.fields || {};
      clientesMap[c.id] = {
        nombre: f['Nombre'] || f['Cliente'] || f['Name'] || '',
        telefono: f['Telefono'] || f['Teléfono'] || f['Phone'] || f['Celular'] || ''
      };
    });

    const tecnicosMap = {};
    tecnicosRecords.forEach(t => {
      const f = t.fields || {};
      tecnicosMap[t.id] = {
        nombre: f['Nombre'] || f['Tecnico'] || f['Técnico'] || f['Name'] || ''
      };
    });

    const enrichedRecords = citasRecords.map(cita => {
      const fields = { ...cita.fields };

      if (Array.isArray(fields['Cliente']) && fields['Cliente'].length > 0) {
        const clienteId = fields['Cliente'][0];
        if (clientesMap[clienteId]) {
          fields['Cliente_Nombre'] = clientesMap[clienteId].nombre;
          fields['Cliente_Telefono'] = clientesMap[clienteId].telefono;
        }
      }

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

// 2. ACTUALIZAR ESTADO DE CITA (PATCH /api/citas/:id)
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

// 3. RUTA COMODÍN ULTRA-RESILIENTE (Busca index.html en /public o en la raíz)
app.get('*', (req, res) => {
  const possiblePaths = [
    path.join(__dirname, 'public', 'index.html'),
    path.join(__dirname, 'public', 'Index.html'),
    path.join(__dirname, 'index.html'),
    path.join(__dirname, 'Index.html')
  ];

  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
  }

  // Diagnóstico visual si no se encuentra el archivo
  try {
    const rootFiles = fs.readdirSync(__dirname);
    let publicFiles = [];
    if (fs.existsSync(path.join(__dirname, 'public'))) {
      publicFiles = fs.readdirSync(path.join(__dirname, 'public'));
    }
    return res.status(404).send(`
         <div style="font-family: sans-serif; padding: 40px; background: #0f172a; color: #f8fafc; min-height: 100vh;">
        <h2 style="color: #f87171;">⚠️ Archivo index.html no encontrado</h2>
        <p>El servidor está funcionando, pero no encontró <code>index.html</code> en <code>/public</code> ni en la raíz.</p>
        <p><strong>Archivos encontrados en la raíz:</strong> ${rootFiles.join(', ')}</p>
        <p><strong>Archivos encontrados en /public:</strong> ${publicFiles.length > 0 ? publicFiles.join(', ') : '(carpeta no existe o vacía)'}</p>
      </div>
    `);
  } catch (err) {
    return res.status(404).send('No se encontró index.html');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor seguro corriendo en el puerto ${PORT}`);
});
