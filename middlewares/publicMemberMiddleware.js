const memberModal = require('../models/memberModal');

module.exports = async (req, res, next) => {
    if (!req.headers.token) {
        return res.status(403).send({
            ok: false,
            data: 'Wrong token',
        });
    }

    let member = await memberModal.findById(req.params.member_id);

    if (!member) {
        return res.status(403).send({
            ok: false,
            data: 'Wrong ID',
        });
    }

    req.member = member;

    next();
};
