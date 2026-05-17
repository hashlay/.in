const express = require('express');
const r = express.Router();
const c = require('../controllers/settingsController');
const { verifyToken } = require('../middleware/auth');

r.get('/public', c.getPublic);
r.get('/beforeAfter', (req, res, next) => { req.params.key = 'beforeAfter'; next(); }, c.get);
r.get('/videoSection', (req, res, next) => { req.params.key = 'videoSection'; next(); }, c.get);
r.get('/carCareSection', (req, res, next) => { req.params.key = 'carCareSection'; next(); }, c.get);

r.get('/', verifyToken, c.getAll);
r.get('/:key', verifyToken, c.get);
r.put('/:key', verifyToken, c.update);
r.patch('/:key', verifyToken, c.update);
r.post('/batch', verifyToken, c.updateMany);
r.delete('/:key', verifyToken, c.delete);

module.exports = r;
