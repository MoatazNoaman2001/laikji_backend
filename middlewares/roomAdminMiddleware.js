const roomModel = require('../models/roomModel');
const helpers = require('../helpers/helpers');

module.exports = async (req, res, next) => {
    if (!req.headers.token) {
        return res.status(403).send({
            ok: false,
            data: 'Wrong token',
        });
    }
    let room = await roomModel.findById(req.params.room_id).populate('groupRef');
    let xuser = await helpers.getUserByToken(req.headers.token);

    if (!xuser) {
        return res.status(403).send({
            ok: false,
            data: 'Wrong token',
        });
    }

    req.user = xuser;

    if (!room)
        return res.status(400).send({
            ok: false,
            data: 'Wrong room id',
        });
    else {
        req.room = room;
        next();
    }
};
