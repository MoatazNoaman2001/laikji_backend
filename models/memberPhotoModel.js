const mongoose = require('mongoose');
const { getNowDateTime } = require('../helpers/tools');
const Schema = mongoose.Schema;

const schema = Schema({
    memberRef: {
        type: Schema.Types.ObjectId,
        ref: 'members',
    },
    senderRef: {
        type: Schema.Types.ObjectId,
        ref: 'users',
    },
    title: String,
    path: String,
    comments_count: {
        type: Number,
        default: 0
    },
    has_new_comments: {
        type: Boolean,
        default: false,
    },
    is_approved: {
        type: Boolean,
        default: true,
    },
    creationDate: {
        type: Date,
        default: getNowDateTime,
    },
});

module.exports = mongoose.model('mamberphotos', schema);
