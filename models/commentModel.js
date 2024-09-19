const mongoose = require('mongoose');
const { getNowDateTime } = require('../helpers/tools');
const Schema = mongoose.Schema;

const schema = Schema({
    memberRef: {
        type: Schema.Types.ObjectId,
        ref: 'members',
    },
    userRef: {
        type: Schema.Types.ObjectId,
        ref: 'users',
    },
    body: String,
    creationDate: {
        type: Date,
        default: getNowDateTime,
    },
});

module.exports = mongoose.model('comments', schema);
