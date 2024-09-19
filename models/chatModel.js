const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = Schema({
    roomRef: {
        type: Schema.Types.ObjectId,
        ref: 'Rooms',
    },
    name: String,
    isMain: Boolean,
});

module.exports = mongoose.model('Chats', schema);
