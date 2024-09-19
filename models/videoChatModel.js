const mongoose = require('mongoose');
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
    key: String,
});

module.exports = mongoose.model('VideoChats', schema);
