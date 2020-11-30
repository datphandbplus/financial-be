const express = require( 'express' );

const LezoProjectHandler = require( '@handlers/ext/lezo/lezo_project' );

const { ApiCache } = require( '@helpers' );
const { validateRoleRequest } = require( '@middlewares' );
const { STATUS_CODE } = require( '@resources' );

const router = express.Router();

router.use( '/', ( req, res, next ) => {
	const channelId = res.locals.channel_id;
	const userData = res.locals.user_data;

	req.LezoProjectHandler = new LezoProjectHandler( channelId, userData );
	next();
} );

router.get(
	'/list',
	ApiCache.cache(),
	validateRoleRequest( [ 'CEO', 'ADMIN' ] ),
	async ( req, res, next ) => {
		try {
			const result = await req.LezoProjectHandler.handleGetAll();

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

module.exports = router;
