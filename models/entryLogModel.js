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
        ref: 'members',
    },
    type: Number,
    strong: {
        type: Number,
        default: 0,
    },
    name: String,
    user_color: {
        type: String,
        default: '0|0|0',
    },
    country: String,
    permissions: String,
    ip: String,
    devcie: String,
    key: String,
    enterDate: Date,
    exitDate: Date,
    stayTime: String,
    reason: Number,
    creationDate: {
        type: Date,
        default: getNowDateTime,
    },
});

module.exports = mongoose.model('EntryLogs', schema);
