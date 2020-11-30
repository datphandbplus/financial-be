const express = require( 'express' );

const ProjectPaymentPlanHandler = require( '@handlers/finance/project/project_payment_plan' );

const { ApiCache, Validator } = require( '@helpers' );
const { validateRoleRequest } = require( '@middlewares' );
const { STATUS_CODE, CONSTANTS } = require( '@resources' );

const router = express.Router();

router.use( '/', ( req, res, next ) => {
	const channelId = res.locals.channel_id;
	const userData = res.locals.user_data;

	req.ProjectPaymentPlanHandler = new ProjectPaymentPlanHandler( channelId, userData );
	next();
} );

router.get(
	'/list',
	ApiCache.cache( CONSTANTS.API_CACHE_EXPIRE ),
	validateRoleRequest([
		'CEO', 'CFO', 'GENERAL_ACCOUNTANT',
		'LIABILITIES_ACCOUNTANT', 'PROCUREMENT_MANAGER',
		'CONSTRUCTION_MANAGER', 'PM',
	]),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectPaymentPlanHandler.handleGetAll( req.query );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.post( '/create', validateRoleRequest( [ 'PM' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'project_id' ).notEmpty();
		req.checkBody( 'name' ).notEmpty().isLength( { min: 1, max: 255 } );
		req.checkBody( 'target_date' ).notEmpty();
		req.checkBody( 'target_percent' ).notEmpty().isInt( { min: 0, max: 100 } );

		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectPaymentPlanHandler.handleCreate( req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.put( '/update/:id', validateRoleRequest( [ 'PM' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'name' ).notEmpty().isLength( { min: 1, max: 255 } );
		req.checkBody( 'target_date' ).notEmpty();
		req.checkBody( 'target_percent' ).notEmpty().isInt( { min: 0, max: 100 } );

		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectPaymentPlanHandler.handleUpdate( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.delete( '/delete/:id', validateRoleRequest( [ 'PM' ] ), async ( req, res, next ) => {
	try {
		const result = await req.ProjectPaymentPlanHandler.handleDelete( +req.params.id );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

module.exports = router;
