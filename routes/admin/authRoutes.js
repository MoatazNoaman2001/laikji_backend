const express = require('express');
const User = require('../../models/managerModel');
const router = express.Router();
const helpers = require('../../helpers/helpers');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const {
    sendPasswordResetEmail,
    generateVerificationToken,
} = require('../../helpers/managerHelpers');
const authCheckMiddleware = require('../../middlewares/authCheckMiddleware');

router.get('/all', async (req, res) => {
    var page = req.query.page ? req.query.page : 1;
    var in_page = 10000;
    try {
        var response = [];
        var items = await User.find();
        items = items.map((item) => {
            item = JSON.parse(JSON.stringify(item));
            response.push(item);
            return item;
        });

        res.status(200).send({
            ok: true,
            page: page,
            in_page: in_page,
            all_pages: 10,
            data: response,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'خطأ في الاسم أو كلمة المرور' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'خطأ في الاسم أو كلمة المرور' });
        }

        const accessToken = helpers.generateToken(user._id);
        res.json({ accessToken, user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

router.post('/', async (req, res) => {
    const { username, email, password, permissions } = req.body;
    console.log('auth ', username, email, password, permissions);
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'هذا الاسم موجود مسبقا' });
        }
        // Create a new user
        const pass = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: pass, email, permissions });
        await newUser.save();

        res.status(201).json({
            ok: true,
            message: 'تم تسجيلك بنجاح!',
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ ما' + error.toString() });
    }
});

router.post('/request-password-reset', async (req, res) => {
    const { email } = req.body;
    try {
        // Find the user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'البريد الإلكتروني غير مسجل' });
        }

        const token = generateVerificationToken(user._id);
        console.log('token id', token);
        // Send the password reset email
        await sendPasswordResetEmail(email, token);

        res.status(200).json({
            message: 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني',
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ ما!' });
    }
});
router.post('/reset-password', async (req, res) => {
    const token = req.body.token;
    const newPassword = req.body.password;
    try {
        var token_user = jwt.verify(token, 'catsandogs');
        console.log('token user ', token_user);
        if (!token_user || !token_user.userId) {
            return res
                .status(400)
                .json({ message: 'رابط إعادة التعيين غير صالح أو منتهي الصلاحية' });
        }
        await User.findOne({
            _id: token_user.userId,
        });
        const userId = token_user.userId;
        console.log('userid ', userId);
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const user = await User.findByIdAndUpdate(userId, { password: hashedPassword });
        res.status(200).json({ message: 'تمت اعادة ضبط كلمة السر بنجاح', token, user });
    } catch (error) {
        res.status(400).json({ message: 'حدث خطأ ما!' });
    }
});

router.get('/:id', async (req, res) => {
    const id = req.params.id;
    try {
        let item = await User.find({
            _id: id,
        });

        res.status(200).send({
            ok: true,
            data: item[0],
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

router.put('/:id', authCheckMiddleware, async (req, res) => {
    const id = req.params.id;

    let update = {
        username: req.body.username,
        email: req.body.email,
        permissions: req.body.permissions,
    };
    if (req.body.password.length !== 0) {
        const pass = await bcrypt.hash(req.body.password, 10);
        update.password = pass;
    }
    await User.findOneAndUpdate(
        {
            _id: id,
        },
        update,
    );

    res.status(200).send({
        ok: true,
    });
});
router.delete('/:id', authCheckMiddleware, async (req, res) => {
    const id = req.params.id;
    const manager = await User.findById(id);

    manager.delete();

    res.status(200).send({
        ok: true,
    });
});
module.exports = router;
