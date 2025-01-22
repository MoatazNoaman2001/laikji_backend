const express = require('express');
const User = require('../../models/managerModel');
const router = express.Router();
const helpers = require('../../helpers/helpers');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { sendPasswordResetEmail } = require('../../helpers/managerHelpers');
// Login route

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
        console.log('response length ', response.length);

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
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
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
    const { username, password } = req.body;
    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'هذا الاسم موجود مسبقا' });
        }
        // Create a new user
        const newUser = new User({ username, password });
        await newUser.save();

        res.status(201).json({
            message: 'تم تسجيلك بنجاح!',
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ ما' + error.toString() });
    }
});

router.post('/request-password-reset', async (req, res) => {
    const { username } = req.body;
    try {
        // Find the user by email
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ message: 'البريد الإلكتروني غير مسجل' });
        }

        const token = helpers.generateToken(user._id);
        console.log('token id', token);
        // Send the password reset email
        await sendPasswordResetEmail(username, token);

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
        var token_user = jwt.verify(token, process.env.JWT_SECRET);
        if (!token_user) return false;
        await User.findOne({
            _id: token_user.id,
        });
        const userId = token_user.id;
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.findByIdAndUpdate(userId, { password: hashedPassword });
        res.status(200).json({ message: 'تمت اعادة ضبط كلمة السر بنجاح' });
    } catch (error) {
        res.status(400).json({ message: 'حدث خطأ ما!' });
    }
});

router.get('/reset-password', async (req, res) => {
    const token = req.query.token;
    try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Decoded token:', decoded); // Debug log

        if (!decoded || !decoded.id) {
            return res
                .status(400)
                .json({ message: 'رابط إعادة التعيين غير صالح أو منتهي الصلاحية' });
        }

        // Hash the new password
        // const hashedPassword = await bcrypt.hash(password, 10);

        // Update the password in the database
        // await User.findByIdAndUpdate(decoded.id, { password: hashedPassword });

        res.status(200).json({ message: 'تمت إعادة تعيين كلمة المرور بنجاح' });
    } catch (error) {
        console.error(error);
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

router.put('/:id', async (req, res) => {
    const id = req.params.id;
    let update = {
        username: req.body.username,
        password: req.body.password,
    };

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
router.delete('/:id', async (req, res) => {
    const id = req.params.id;
    const manager = await User.findById(id);

    manager.delete();

    res.status(200).send({
        ok: true,
    });
});
module.exports = router;
