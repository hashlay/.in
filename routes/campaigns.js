const express = require('express');
const r = express.Router();
const { getCampaigns, createCampaign, sendCampaign, deleteCampaign } = require('../controllers/miscControllers');
const { verifyToken } = require('../middleware/auth');
r.get('/', verifyToken, getCampaigns);
r.post('/', verifyToken, createCampaign);
r.post('/:id/send', verifyToken, sendCampaign);
r.delete('/:id', verifyToken, deleteCampaign);
module.exports = r;
