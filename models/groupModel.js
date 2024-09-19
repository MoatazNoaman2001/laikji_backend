const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const enums = require('../helpers/enums');

const schema = Schema({
    name: String,
    icon: {
        type: String,
        default: '',
    },
    type: {
        type: Number,
        default: enums.groupsTypes.country,
    },
    order: {
        type: Number,
        default: -1,
    },
    background: {
        type: String,
        default: '16|145|195',
    },
});

module.exports = mongoose.model('Groups', schema);
