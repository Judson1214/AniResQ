const express = require('express');
const { createRescueRequest, getRescueRequests, updateRescueRequest } = require('../controllers/rescueController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/')
    .post(protect, createRescueRequest)
    .get(getRescueRequests);

router.route('/:id')
    .put(protect, authorize('ngo', 'volunteer', 'admin'), updateRescueRequest);

module.exports = router;
