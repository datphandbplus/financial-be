const express = require( 'express' );

const LezoEmployeeHandler = require( '@handlers/ext/lezo/lezo_employee' );

const { ApiCache } = require( '@helpers' );
const { validateRoleRequest } = require( '@middlewares' );
const { STATUS_CODE } = require( '@resources' );

const router = express.Router();

router.use( '/', ( req, res, next ) => {
	const channelId = res.locals.channel_id;
	const userData = res.locals.user_data;

	req.LezoEmployeeHandler = new LezoEmployeeHandler( channelId, userData );
	next();
} );

router.get(
	'/list',
	ApiCache.cache(),
	validateRoleRequest( [ 'CEO', 'ADMIN' ] ),
	async ( req, res, next ) => {
		try {
			const result = await req.LezoEmployeeHandler.handleGetAll();

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

module.exports = router;
