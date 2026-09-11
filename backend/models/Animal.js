const mongoose = require('mongoose');

const animalSchema = new mongoose.Schema({
    name: { type: String },
    species: { type: String, required: true },
    breed: { type: String },
    ageGroup: {
        type: String,
        enum: ['infant', 'young', 'adult', 'senior']
    },
    status: {
        type: String,
        enum: ['stray', 'rescued', 'fostered', 'adoptable', 'adopted'],
        default: 'stray'
    },
    medicalHistory: [{
        condition: String,
        treatment: String,
        date: Date,
        vetId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    media: [String], // Array of URLs
    managingEntity: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // NGO or Shelter managing the animal
}, { timestamps: true });

module.exports = mongoose.model('Animal', animalSchema);
