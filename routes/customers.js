const express = require('express');
const r = express.Router();
const c = require('../controllers/customerController');
const { verifyToken } = require('../middleware/auth');

// Public
r.post('/register', c.register);
r.post('/login',    c.login);

// Admin
r.get('/',               verifyToken, c.getCustomers);
r.get('/accounts',       verifyToken, c.getAccounts);
r.get('/export/csv',     verifyToken, c.exportCSV);
r.post('/',              verifyToken, c.createCustomer);
r.get('/:id',            verifyToken, c.getCustomer);
r.put('/:id',            verifyToken, c.updateCustomer);
r.delete('/:id',         verifyToken, c.deleteCustomer);
r.get('/:id/orders',     verifyToken, c.getCustomerOrders);

module.exports = r;
