const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const enums = require('../helpers/enums');
const { getNowDateTime } = require('../helpers/tools');

const schema = Schema({
    username: String,
    password: String,
    roomRefs: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Rooms',
        },
    ],
    type: {
        type: Number,
        default: enums.userTypes.guest,
    },
    permissions: String,
    strong: {
        type: Number,
        default: 0,
    },
    locked_key: String,
    is_locked: {
        type: Boolean,
        default: false,
    },
    creationDate: {
        type: Date,
        default: getNowDateTime,
    },
});

module.exports = mongoose.model('RegUsers', schema);
