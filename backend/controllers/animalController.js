const Animal = require('../models/Animal');

// @desc    Create a new animal profile
// @route   POST /api/animals
// @access  Private (NGO, Shelter, Admin)
exports.createAnimal = async (req, res) => {
    try {
        const { name, species, breed, ageGroup, status, media } = req.body;

        const animal = await Animal.create({
            name,
            species,
            breed,
            ageGroup,
            status,
            media,
            managingEntity: req.user.id
        });

        res.status(201).json(animal);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all animals (with filtering)
// @route   GET /api/animals
// @access  Public
exports.getAnimals = async (req, res) => {
    try {
        const query = {};
        if (req.query.status) query.status = req.query.status;
        if (req.query.species) query.species = req.query.species;

        const animals = await Animal.find(query)
            .populate('managingEntity', 'name location')
            .sort({ createdAt: -1 });

        res.json(animals);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single animal by ID
// @route   GET /api/animals/:id
// @access  Public
exports.getAnimalById = async (req, res) => {
    try {
        const animal = await Animal.findById(req.params.id)
            .populate('managingEntity', 'name email phone location')
            .populate('medicalHistory.vetId', 'name');

        if (animal) {
            res.json(animal);
        } else {
            res.status(404).json({ message: 'Animal not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update animal profile
// @route   PUT /api/animals/:id
// @access  Private (NGO, Shelter, Admin)
exports.updateAnimal = async (req, res) => {
    try {
        const animal = await Animal.findById(req.params.id);

        if (!animal) {
            return res.status(404).json({ message: 'Animal not found' });
        }

        // Only allow managing entity or admin to update
        if (animal.managingEntity.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized to update this animal' });
        }

        const updatedAnimal = await Animal.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updatedAnimal);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
