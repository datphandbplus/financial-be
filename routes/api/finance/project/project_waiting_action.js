const express = require( 'express' );

const ProjectWaitingActionHandler = require( '@handlers/finance/project/project_waiting_action' );

const { ApiCache } = require( '@helpers' );
const { validateRoleRequest } = require( '@middlewares' );
const { STATUS_CODE, CONSTANTS } = require( '@resources' );

const router = express.Router();

router.use( '/', ( req, res, next ) => {
	const channelId = res.locals.channel_id;
	const userData = res.locals.user_data;

	req.ProjectWaitingActionHandler = new ProjectWaitingActionHandler( channelId, userData );
	next();
} );

router.get(
	'/:id',
	ApiCache.cache( CONSTANTS.API_CACHE_EXPIRE ),
	validateRoleRequest([
		'CEO', 'CFO', 'GENERAL_ACCOUNTANT',
		'LIABILITIES_ACCOUNTANT', 'PROCUREMENT_MANAGER', 'SALE',
		'PM', 'PURCHASING', 'QS',
	]),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectWaitingActionHandler.handleGetAll( req.params.id, req.query );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

module.exports = router;
