const mongoose = require('mongoose');
const { getNowDateTime } = require('../helpers/tools');
const Schema = mongoose.Schema;

const schema = Schema({
    isRead: {
        type: Boolean,
        default: false,
    },
    chatRef: {
        type: Schema.Types.ObjectId,
        ref: 'PrivateChats',
    },
    userRef: {
        type: Schema.Types.ObjectId,
        ref: 'Users',
    },
    isUser1Deleted: {
        type: Boolean,
        default: false,
    },
    isUser2Deleted: {
        type: Boolean,
        default: false,
    },
    body: Object,
    creationDate: {
        type: Date,
        default: getNowDateTime,
    },
});

module.exports = mongoose.model('PrivateMessages', schema);
