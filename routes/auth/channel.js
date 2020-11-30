const express = require( 'express' );

const { TokenGenerator, Authentication, Factory } = require( '@helpers' );
const { STATUS_CODE } = require( '@resources' );

const router = express.Router();
const SERVER = Factory.getConfig( 'server' );

router.get( '/check/?:id', async ( req, res, next ) => {
	try {
		const channelId = SERVER.MULTI_CHANNELS ? req.params.id : SERVER.DEFAULT_CHANNEL;
		const authentication = new Authentication( channelId );
		const channel = await authentication.getChannel();

		res.status( STATUS_CODE.OK );

		if ( !channel ) {
			res.json({
				status	: false,
				message	: 'CHANNEL_NOT_FOUND',
			});
			return;
		}

		const appAvailable = await authentication.checkAppAvailable();

		if ( !appAvailable ) {
			res.json({
				status	: false,
				message	: 'APP_UNAVAILABLE',
			});
			return;
		}

		res.json({
			status: true,
			data: {
				id		: channel.id,
				name	: channel.name,
				token	: TokenGenerator.encrypt( { channel_id: channel.id } ),
			},
		});
	} catch ( error ) {
		next( error );
	}
} );

module.exports = router;
