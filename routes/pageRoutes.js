const express = require('express');
const { getSettings } = require('../helpers/tools');
const router = express.Router();

router.get('/terms', async (req, res) => {
    const settings = await getSettings();
    try {
        res.status(200).send({
            ok: true,
            data:
                '<div class="content" style="white-space: pre-line;color: ' +
                settings.rgb_terms_fnt +
                ';">' +
                settings?.terms?.replaceAll('\r\n', '<br/>') +
                '</div>',
        });
    } catch (e) {
        res.status(500).send({
            ok: false,
            error: e.message,
        });
    }
});

module.exports = router;
