const mongoose = require('mongoose');
const { getNowDateTime } = require('../helpers/tools');
const Schema = mongoose.Schema;

const schema = Schema({
    userRef: {
        type: Schema.Types.ObjectId,
        ref: 'Users',
    },
    roomRef: {
        type: Schema.Types.ObjectId,
        ref: 'Rooms',
    },
    creationDate: {
        type: Date,
        default: getNowDateTime,
    },
});

module.exports = mongoose.model('VoiceStack', schema);
