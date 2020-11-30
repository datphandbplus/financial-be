const MAILER = {
	HOST	: 'mail.dbplus.com.vn',
	PORT	: 587,
	SECURE	: false,
	TLS		: { rejectUnauthorized: false },
	AUTH: {
		USER: 'no-rep@dbplus.com.vn',
		PASS: 'Dbplus@2019',
	},
	DEFAULT: {
		FROM: '"DBplus" <no-rep@dbplus.com.vn>',
	},
};

module.exports = MAILER;
