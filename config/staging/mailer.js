const MAILER = {
	HOST	: 'smtp.gmail.com',
	PORT	: 587,
	SECURE	: false,
	TLS		: { rejectUnauthorized: false },
	AUTH: {
		USER: 'jquy123@gmail.com',
		PASS: 'hjdhuvkzvomxxmgk',
	},
	DEFAULT: {
		FROM: '"Financial Tool" <mailer@revolve.vn>',
	},
};

module.exports = MAILER;
