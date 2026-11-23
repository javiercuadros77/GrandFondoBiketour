{\rtf1\ansi\ansicpg1252\cocoartf2908
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fmodern\fcharset0 Courier;}
{\colortbl;\red255\green255\blue255;\red250\green181\blue122;\red255\green255\blue255;\red255\green255\blue154;
\red149\green255\blue145;\red199\green76\blue81;\red117\green117\blue117;}
{\*\expandedcolortbl;;\cssrgb\c98824\c76078\c54902;\csgray\c100000;\cssrgb\c100000\c100000\c66667;
\cssrgb\c63529\c98824\c63529;\cssrgb\c82745\c38824\c38824;\cssrgb\c53333\c53333\c53333;}
\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0

\f0\fs28 \cf2 const\cf3  express = \cf4 require\cf3 (\cf5 'express'\cf3 );\
\cf2 const\cf3  cors = \cf4 require\cf3 (\cf5 'cors'\cf3 );\
\cf2 const\cf3  path = \cf4 require\cf3 (\cf5 'path'\cf3 );\
\
\cf2 const\cf3  app = express();\
\cf2 const\cf3  PORT = process.env.PORT || \cf6 3000\cf3 ;\
\
\cf7 // Variables de entorno privadas le\'eddas desde Render\cf3 \
\cf2 const\cf3  AIRTABLE_PAT = process.env.AIRTABLE_PAT;\
\cf2 const\cf3  AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;\
\cf2 const\cf3  AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || \cf5 'Citas'\cf3 ;\
\
app.use(cors());\
app.use(express.json());\
app.use(express.static(path.join(__dirname, \cf5 'public'\cf3 )));\
\
\cf7 // Middleware de verificaci\'f3n de variables\cf3 \
app.use(\cf5 '/api'\cf3 , (req, res, next) => \{\
  \cf2 if\cf3  (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) \{\
    \cf2 return\cf3  res.status(\cf6 500\cf3 ).json(\{ \
      error: \cf5 'Variables de entorno no configuradas en Render. Define AIRTABLE_PAT y AIRTABLE_BASE_ID en Environment.'\cf3  \
    \});\
  \}\
  next();\
\});\
\
\cf7 // Obtener todas las citas\cf3 \
app.get(\cf5 '/api/citas'\cf3 , \cf2 async\cf3  (req, res) => \{\
  \cf2 const\cf3  url = \cf5 `https://api.airtable.com/v0/$\{AIRTABLE_BASE_ID\}/$\{\cf4 encodeURIComponent\cf5 (AIRTABLE_TABLE_NAME)\}`\cf3 ;\
  \cf2 try\cf3  \{\
    \cf2 const\cf3  response = \cf2 await\cf3  fetch(url, \{\
      headers: \{\
        \cf5 'Authorization'\cf3 : \cf5 `Bearer $\{AIRTABLE_PAT\}`\cf3 ,\
        \cf5 'Content-Type'\cf3 : \cf5 'application/json'\cf3 \
      \}\
    \});\
\
    \cf2 if\cf3  (!response.ok) \{\
      \cf2 const\cf3  errorText = \cf2 await\cf3  response.text();\
      \cf2 return\cf3  res.status(response.status).json(\{ error: errorText \});\
    \}\
\
    \cf2 const\cf3  data = \cf2 await\cf3  response.json();\
    res.json(data);\
  \} \cf2 catch\cf3  (error) \{\
    \cf4 console\cf3 .error(\cf5 'Error al consultar Airtable:'\cf3 , error);\
    res.status(\cf6 500\cf3 ).json(\{ error: \cf5 'Error interno del servidor al consultar Airtable'\cf3  \});\
  \}\
\});\
\
\cf7 // Actualizar estado de cita\cf3 \
app.patch(\cf5 '/api/citas/:id'\cf3 , \cf2 async\cf3  (req, res) => \{\
  \cf2 const\cf3  \{ id \} = req.params;\
  \cf2 const\cf3  \{ fields \} = req.body;\
\
  \cf2 const\cf3  url = \cf5 `https://api.airtable.com/v0/$\{AIRTABLE_BASE_ID\}/$\{\cf4 encodeURIComponent\cf5 (AIRTABLE_TABLE_NAME)\}/$\{id\}`\cf3 ;\
  \cf2 try\cf3  \{\
    \cf2 const\cf3  response = \cf2 await\cf3  fetch(url, \{\
      method: \cf5 'PATCH'\cf3 ,\
      headers: \{\
        \cf5 'Authorization'\cf3 : \cf5 `Bearer $\{AIRTABLE_PAT\}`\cf3 ,\
        \cf5 'Content-Type'\cf3 : \cf5 'application/json'\cf3 \
      \},\
      body: \cf4 JSON\cf3 .stringify(\{ fields \})\
    \});\
\
    \cf2 if\cf3  (!response.ok) \{\
      \cf2 const\cf3  errorText = \cf2 await\cf3  response.text();\
      \cf2 return\cf3  res.status(response.status).json(\{ error: errorText \});\
    \}\
\
    \cf2 const\cf3  data = \cf2 await\cf3  response.json();\
    res.json(data);\
  \} \cf2 catch\cf3  (error) \{\
    \cf4 console\cf3 .error(\cf5 'Error al actualizar cita en Airtable:'\cf3 , error);\
    res.status(\cf6 500\cf3 ).json(\{ error: \cf5 'Error interno al actualizar la cita'\cf3  \});\
  \}\
\});\
\
\cf7 // Servir la p\'e1gina principal\cf3 \
app.get(\cf5 '*'\cf3 , (req, res) => \{\
  res.sendFile(path.join(__dirname, \cf5 'public'\cf3 , \cf5 'index.html'\cf3 ));\
\});\
\
app.listen(PORT, () => \{\
  \cf4 console\cf3 .log(\cf5 `Servidor seguro corriendo en el puerto $\{PORT\}`\cf3 );\
\});}