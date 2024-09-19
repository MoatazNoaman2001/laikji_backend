const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = Schema({
    memberRef: {
        type: Schema.Types.ObjectId,
        ref: 'members',
    },
    key: String,
});

module.exports = mongoose.model('views', schema);
