const mongoose = require('mongoose');

const rescueRequestSchema = new mongoose.Schema({
    reporter: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    description: { type: String, required: true },
    urgency: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true } // [lng, lat]
    },
    status: {
        type: String,
        enum: ['pending', 'assigned', 'in-progress', 'resolved', 'closed'],
        default: 'pending'
    },
    assignedTo: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    media: [String], // Array of image URLs
    animalRef: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Animal' 
    }
}, { timestamps: true });

rescueRequestSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('RescueRequest', rescueRequestSchema);
