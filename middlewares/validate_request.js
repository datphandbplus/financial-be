const { Authentication } = require( '@helpers' );
const { STATUS_CODE, STATUS_MESSAGE } = require( '@resources' );

const validateRequest = async ( req, res, next ) => {
	try {
		const channelId = req.headers[ 'x-channel-id' ];
		const channelToken = req.headers[ 'x-channel-token' ];
		const accountId = req.headers[ 'x-account-id' ];
		const accountToken = req.headers[ 'x-account-token' ];

		if ( !channelId || !channelToken
			|| !accountId || !accountToken ) {
			next({
				status	: STATUS_CODE.UNAUTHORIZED,
				message	: STATUS_MESSAGE.UNAUTHORIZED,
			});
			return;
		}

		const user = await new Authentication( channelId )
		.checkAccountToken( channelToken, accountId, accountToken );

		res.locals.user_id = user.id;
		res.locals.user_data = user;
		next();
	} catch {
		next({
			status	: STATUS_CODE.UNAUTHORIZED,
			message	: STATUS_MESSAGE.UNAUTHORIZED,
		});
	}
};

module.exports = validateRequest;
