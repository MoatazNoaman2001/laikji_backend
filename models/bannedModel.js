const mongoose = require('mongoose');
const { getNowDateTime } = require('../helpers/tools');
const Schema = mongoose.Schema;
const enums = require('../helpers/enums');

const schema = Schema({
    roomRef: {
        type: Schema.Types.ObjectId,
        ref: 'rooms',
    },
    userRef: {
        type: Schema.Types.ObjectId,
        ref: 'Users',
    },
    memberRef: {
        type: Schema.Types.ObjectId,
        ref: 'members',
    },
    bannerRef: {
        type: Schema.Types.ObjectId,
        ref: 'Users',
    },
    parentBanRef: String,
    name: String,
    country: String,
    ip: String,
    device: String,
    key: String,
    until: Date,
    banner_strong: {
        type: Number,
        default: 0,
    },
    type: {
        type: Number,
        default: enums.banTypes.room,
    },
    level: {
        type: Number,
        default: enums.banTypes.room,
    },
    creationDate: {
        type: Date,
        default: getNowDateTime,
    },
});

module.exports = mongoose.model('Banned', schema);
