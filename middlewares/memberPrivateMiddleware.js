module.exports = async (req, res, next) => {
    if (req.member._id.toString() != req.user.memberRef.toString()) {
        return res.status(401).send({
            ok: false,
            data: 'Unauthorized',
        });
    }

    next();
};
