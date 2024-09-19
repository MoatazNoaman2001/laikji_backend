const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const enums = require('../helpers/enums');
const { getNowDateTime } = require('../helpers/tools');

const schema = Schema({
    roomRef: {
        type: Schema.Types.ObjectId,
        ref: 'rooms',
    },
    userRef: {
        type: Schema.Types.ObjectId,
        ref: "users",
    },
    memberRef: {
        type: Schema.Types.ObjectId,
        ref: "members",
    },
    name: String,
    type: {
        type: Number,
        default: enums.userTypes.guest,
    },
    action_ar: String,
    action_en: String,
    affected: String,
    creationDate: {
        type: Date,
        default: getNowDateTime,
    },
});

module.exports = mongoose.model('AdminLogs', schema);
