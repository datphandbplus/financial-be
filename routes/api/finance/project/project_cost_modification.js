const express = require( 'express' );

const ProjectCostModificationHandler = require( '@handlers/finance/project/project_cost_modification' );

const { ApiCache, Validator } = require( '@helpers' );
const { validateRoleRequest } = require( '@middlewares' );
const { STATUS_CODE, CONSTANTS } = require( '@resources' );

const router = express.Router();

router.use( '/', ( req, res, next ) => {
	const channelId = res.locals.channel_id;
	const userData = res.locals.user_data;

	req.ProjectCostModificationHandler = new ProjectCostModificationHandler( channelId, userData );
	next();
} );

router.get(
	'/list',
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectCostModificationHandler.handleGetAll( req.query );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.put( '/modify-cost/:id', validateRoleRequest( [ 'PURCHASING', 'PROCUREMENT_MANAGER' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'amount' ).notEmpty().isFloat( { min: 0 } );
		req.checkBody( 'price' ).notEmpty().isFloat( { min: 0 } );

		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectCostModificationHandler.handleModifyCost( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.put( '/update-status/:id', validateRoleRequest( [ 'CEO', 'PROCUREMENT_MANAGER' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'status' ).notEmpty().isIn( [
			CONSTANTS.COST_MODIFICATION_STATUS.APPROVED,
			CONSTANTS.COST_MODIFICATION_STATUS.REJECTED,
		] );

		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectCostModificationHandler.handleUpdateStatus( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

module.exports = router;
