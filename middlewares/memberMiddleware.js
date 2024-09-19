const memberModal = require('../models/memberModal');
const roomModel = require('../models/roomModel');
const helpers = require('../helpers/helpers');

module.exports = async (req, res, next) => {
    if (!req.headers.token) {
        return res.status(403).send({
            ok: false,
            data: 'Wrong token',
        });
    }

    let xuser = await helpers.getUserByToken(req.headers.token);

    if (!xuser) {
        return res.status(403).send({
            ok: false,
            data: 'Wrong token',
        });
    }

    req.user = xuser;

    let member = await memberModal.findById(req.params.member_id);

    if (!member) {
        return res.status(403).send({
            ok: false,
            data: 'Wrong File Id',
        });
    }

    req.member = member;

    let room = await roomModel.findById(req.headers.room_id);
    if (!room) {
        return res.status(403).send({
            ok: false,
            data: 'Wrong room Id',
        });
    }
    req.room = room;

    next();
};
