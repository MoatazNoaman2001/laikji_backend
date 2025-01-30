const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { getNowDateTime } = require('../helpers/tools');
const bcrypt = require('bcrypt');

const schema = Schema({
    username: String,
    password: String,
    email: String,
    // type: {
    //     type: Number,
    //     default: enums.userTypes.guest,
    // },
    permissions: String,
    lockModify: {
        type: Boolean,
        default: false,
    },
    creationDate: {
        type: Date,
        default: getNowDateTime,
    },
});
schema.pre('save', async function (next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

module.exports = mongoose.model('Managers', schema);
