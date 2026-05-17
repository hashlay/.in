const express = require('express');
const r = express.Router();
const { getChatbotRules, createChatbotRule, updateChatbotRule, deleteChatbotRule, matchChatbot, getChatbotQueries } = require('../controllers/miscControllers');
const { verifyToken } = require('../middleware/auth');
r.get('/public', getChatbotRules);       // Public: customer site fetches active rules
r.get('/', verifyToken, getChatbotRules); // Admin: full list
r.get('/queries', verifyToken, getChatbotQueries); // Admin: recent queries
r.post('/match', matchChatbot);
r.post('/', verifyToken, createChatbotRule);
r.patch('/:id', verifyToken, updateChatbotRule);
r.delete('/:id', verifyToken, deleteChatbotRule);
module.exports = r;
