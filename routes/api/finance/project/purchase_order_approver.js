const express = require( 'express' );

const PurchaseOrderApproverHandler = require( '@handlers/finance/project/purchase_order_approver' );

const { ApiCache, Validator } = require( '@helpers' );
const { validateRoleRequest } = require( '@middlewares' );
const { STATUS_CODE, CONSTANTS } = require( '@resources' );

const router = express.Router();

router.use( '/', ( req, res, next ) => {
	const channelId = res.locals.channel_id;
	const userData = res.locals.user_data;

	req.PurchaseOrderApproverHandler = new PurchaseOrderApproverHandler( channelId, userData );
	next();
} );

router.get(
	'/list',
	ApiCache.cache( CONSTANTS.API_CACHE_EXPIRE ),
	validateRoleRequest( [
		'CEO', 'PURCHASING',
		'PM', 'PROCUREMENT_MANAGER',
	] ),
	async ( req, res, next ) => {
		try {
			const result = await req.PurchaseOrderApproverHandler.handleGetAll( req.query );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.put( '/update/:id', validateRoleRequest( [
	'CEO', 'PURCHASING',
	'PM', 'PROCUREMENT_MANAGER',
] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'status' ).notEmpty();

		// Validate body
		await Validator.validate( req );

		const result = await req.PurchaseOrderApproverHandler.handleUpdate( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

module.exports = router;
