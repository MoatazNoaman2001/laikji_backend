const userModal = require('../models/userModal');

module.exports = async (req, res, next) => {
    const user = await userModal.findById(req.body.user_id);

    if (!user) {
        return res.status(400).send({
            ok: false,
            error: 'Wrong User id',
        });
    }

    next();
};
