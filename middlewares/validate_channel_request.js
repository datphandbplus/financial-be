const { Authentication } = require( '@helpers' );
const { STATUS_CODE, STATUS_MESSAGE } = require( '@resources' );

const validateChannelRequest = async ( req, res, next ) => {
	try {
		const channelId = req.headers[ 'x-channel-id' ];
		const channelToken = req.headers[ 'x-channel-token' ];

		if ( !channelId || !channelToken ) {
			next({
				status	: STATUS_CODE.UNAUTHORIZED,
				message	: STATUS_MESSAGE.UNAUTHORIZED,
			});
			return;
		}

		const channel = await new Authentication( channelId ).checkChannelToken( channelToken );

		res.locals.channel_id = channelId;
		res.locals.channel_token = channelToken;
		res.locals.channel_data = channel;
		next();
	} catch {
		next({
			status	: STATUS_CODE.UNAUTHORIZED,
			message	: STATUS_MESSAGE.UNAUTHORIZED,
		});
	}
};

module.exports = validateChannelRequest;
