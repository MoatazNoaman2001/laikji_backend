const mongoose = require('mongoose');
const { getNowDateTime } = require('../helpers/tools');
const Schema = mongoose.Schema;

const schema = Schema({
    roomRef: {
        type: Schema.Types.ObjectId,
        ref: 'Rooms',
    },
    userRef: {
        type: Schema.Types.ObjectId,
        ref: 'Users',
    },
    memberRef: {
        type: Schema.Types.ObjectId,
        ref: 'Members',
    },
    reporterName: String,
    reporterId: String,
    roomName: String,
    userName: String,
    ip: String,
    country: String,
    message: String,
    type: Number,
    creationDate: {
        type: Date,
        default: getNowDateTime,
    },
});

module.exports = mongoose.model('Reports', schema);
