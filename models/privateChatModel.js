const mongoose = require('mongoose');
const { getNowDateTime } = require('../helpers/tools');
const Schema = mongoose.Schema;

const schema = Schema({
    key: String,
    newMsgs: {
        type: Number,
        default: 0,
    },
    roomRef: {
        type: Schema.Types.ObjectId,
        ref: 'Rooms',
    },
    user1Ref: {
        type: Schema.Types.ObjectId,
        ref: 'Users',
    },
    user2Ref: {
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
    creationDate: {
        type: Date,
        default: getNowDateTime,
    },
});

module.exports = mongoose.model('PrivateChats', schema);
