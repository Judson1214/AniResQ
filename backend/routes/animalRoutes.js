const express = require('express');
const { createAnimal, getAnimals, getAnimalById, updateAnimal } = require('../controllers/animalController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/')
    .post(protect, authorize('ngo', 'facility_manager', 'admin'), createAnimal)
    .get(getAnimals);

router.route('/:id')
    .get(getAnimalById)
    .put(protect, authorize('ngo', 'facility_manager', 'admin'), updateAnimal);

module.exports = router;
