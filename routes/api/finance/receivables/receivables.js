const express = require( 'express' );

const ProjectBillHandler = require( '@handlers/finance/project/project_bill' );

const { ApiCache } = require( '@helpers' );
const { validateRoleRequest } = require( '@middlewares' );
const { STATUS_CODE, CONSTANTS } = require( '@resources' );

const router = express.Router();

router.use( '/', ( req, res, next ) => {
	const channelId = res.locals.channel_id;
	const userData = res.locals.user_data;

	req.ProjectBillHandler = new ProjectBillHandler( channelId, userData );
	next();
} );

router.get(
	'/',
	ApiCache.cache( CONSTANTS.API_CACHE_EXPIRE ),
	validateRoleRequest([
		'CEO', 'CFO', 'PM',
		'GENERAL_ACCOUNTANT', 'LIABILITIES_ACCOUNTANT', 'PROCUREMENT_MANAGER',
	]),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectBillHandler.handleGetAllReceivables( req.query );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

module.exports = router;
