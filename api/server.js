const express = require('express');
const fs = require('fs');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.get('/', (req, res) => {
  res.send('API Agroroute funcionando');
});

const path = require('path');
const DB_FILE = path.join(__dirname, 'db.json');

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], shipments: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

app.post('/api/v1/auth/sign-up', (req, res) => {
  const { firstName, lastName, dni, birthDate, phoneNumber, email, password } = req.body;
  const db = readDB();
  if (db.users.find(u => u.email === email)) {
    return res.status(400).json({ message: 'Usuario ya existe' });
  }
  const newId = db.users.length > 0 ? db.users[db.users.length - 1].id + 1 : 1;
  db.users.push({ id: newId, firstName, lastName, dni, birthDate, phoneNumber, email, password });
  writeDB(db);
  res.status(201).json({ message: 'Usuario registrado' });
});

app.post('/api/v1/auth/sign-in', (req, res) => {
  const { email, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.email === email && u.password === password);
  if (!user) {
    return res.status(401).json({ message: 'Credenciales inválidas' });
  }
  res.json({ message: 'Login exitoso', user });
});

app.post('/api/v1/shipments', (req, res) => {
  const { trackingNumber, ownerId, destino, fecha, estado, ubicacion, paquetes, destinoLat, destinoLng } = req.body;
  if (!trackingNumber || !ownerId || !destino || !fecha || !paquetes || !Array.isArray(paquetes)) {
    return res.status(400).json({ message: 'Faltan campos requeridos' });
  }
  const db = readDB();
  db.shipments = db.shipments || [];
  const newId = db.shipments.length > 0 ? db.shipments[db.shipments.length - 1].id + 1 : 1;

  const paquetesConId = paquetes.map(pkg => {
  const { shipmentId, sensores = [], ...rest } = pkg;
  const sensoresNumericos = sensores.map(sensor => ({
    ...sensor,
    valor: typeof sensor.valor === 'string' ? parseInt(sensor.valor, 10) : sensor.valor
  }));
  return {
    ...rest,
    shipmentId: newId,
    destino: pkg.destino || destino,
    cliente: pkg.cliente || cliente, 
    destinoLat: pkg.destinoLat !== undefined ? pkg.destinoLat : destinoLat,
    destinoLng: pkg.destinoLng !== undefined ? pkg.destinoLng : destinoLng,
    sensores: sensoresNumericos
  };
});

  const shipment = { id: newId, trackingNumber, ownerId, destino, fecha, estado, ubicacion, paquetes: paquetesConId };
  if (destinoLat !== undefined && destinoLng !== undefined) {
    shipment.destinoLat = destinoLat;
    shipment.destinoLng = destinoLng;
  }
  db.shipments.push(shipment);
  writeDB(db);
  res.status(201).json({ message: 'Envío registrado', id: newId });
});

app.patch('/api/v1/shipments/:shipmentId/packages/:packageCode/sensors/:sensorIndex', (req, res) => {
  const { shipmentId, packageCode, sensorIndex } = req.params;
  const { activo } = req.body;
  const db = readDB();
  const shipment = db.shipments.find(s => s.id == shipmentId);
  if (!shipment) return res.status(404).json({ message: 'Envío no encontrado' });
  const pkg = shipment.paquetes.find(p => p.codigo === packageCode);
  if (!pkg) return res.status(404).json({ message: 'Paquete no encontrado' });
  if (!pkg.sensores || !pkg.sensores[sensorIndex]) return res.status(404).json({ message: 'Sensor no encontrado' });

  pkg.sensores[sensorIndex].activo = !!activo;
  writeDB(db);
  res.json({ message: 'Estado del sensor actualizado', activo: pkg.sensores[sensorIndex].activo });
});

app.get('/api/v1/users/:id', (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
  res.json(user);
});

app.get('/api/v1/shipments', (req, res) => {
  const db = readDB();
  res.json(db.shipments || []);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

app.get('/api/v1/alerts/:userId', (req, res) => {
  const db = readDB();
  const userAlerts = (db.alerts || []).filter(a => a.userId == req.params.userId);
  res.json(userAlerts);
});

app.post('/api/v1/alerts', (req, res) => {
  const db = readDB();
  db.alerts = db.alerts || [];
  const alert = req.body;
  alert.id = Date.now().toString();
  db.alerts.push(alert);
  writeDB(db);
  res.status(201).json(alert);
});

app.patch('/api/v1/alerts/:alertId', (req, res) => {
  const db = readDB();
  const alert = (db.alerts || []).find(a => a.id == req.params.alertId);
  if (!alert) return res.status(404).json({ message: 'Alerta no encontrada' });
  Object.assign(alert, req.body);
  writeDB(db);
  res.json(alert);
});