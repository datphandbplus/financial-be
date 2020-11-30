const express = require( 'express' );

const ProjectVOHandler = require( '@handlers/finance/project/project_vo' );

const { ApiCache, Validator } = require( '@helpers' );
const { validateRoleRequest } = require( '@middlewares' );
const { STATUS_CODE, CONSTANTS } = require( '@resources' );

const router = express.Router();

router.use( '/', ( req, res, next ) => {
	const channelId = res.locals.channel_id;
	const userData = res.locals.user_data;

	req.ProjectVOHandler = new ProjectVOHandler( channelId, userData );
	next();
} );

router.get(
	'/list',
	ApiCache.cache(),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectVOHandler.handleGetAll( req.query );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.get(
	'/:id',
	ApiCache.cache(),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectVOHandler.handleGetOne( +req.params.id, req.query );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.get(
	'/sum-quotation/:project_id',
	ApiCache.cache(),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectVOHandler.handleSumQuotation( +req.params.project_id );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.post( '/create', validateRoleRequest( [ 'QS' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'name' ).notEmpty().isLength( { min: 1, max: 255 } );
		req.checkBody( 'project_id' ).notEmpty();
		req.checkBody( 'vat_percent' ).notEmpty().isFloat( { min: 0, max: 100 } );
		req.checkBody( 'discount_amount' ).notEmpty().isFloat( { min: 0 } );
		req.checkBody( 'discount_type' ).notEmpty().isIn( [ '%', '$' ] );

		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectVOHandler.handleCreate( req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.put( '/update/:id', validateRoleRequest( [ 'QS' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'name' ).notEmpty().isLength( { min: 1, max: 255 } );
		req.checkBody( 'project_id' ).notEmpty();
		req.checkBody( 'vat_percent' ).notEmpty().isFloat( { min: 0, max: 100 } );
		req.checkBody( 'discount_amount' ).notEmpty().isFloat( { min: 0 } );
		req.checkBody( 'discount_type' ).notEmpty().isIn( [ '%', '$' ] );

		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectVOHandler.handleUpdate( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.put( '/remove-items/:id', validateRoleRequest( [ 'QS' ] ), async ( req, res, next ) => {
	try {
		const result = await req.ProjectVOHandler.handleRemoveItems( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.put( '/remove-items-cost/:id', validateRoleRequest( [ 'QS' ] ), async ( req, res, next ) => {
	try {
		const result = await req.ProjectVOHandler.handleRemoveItemsCost( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.put( '/remove-line/:id', validateRoleRequest( [ 'QS' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'line_item_id' ).notEmpty();

		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectVOHandler.handleRemoveLine( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.put( '/remove-cost/:id', validateRoleRequest( [ 'QS' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'cost_item_id' ).notEmpty();

		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectVOHandler.handleRemoveCost( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.put( '/get-approval/:id', validateRoleRequest( [ 'QS' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'status' ).notEmpty().isIn([
			CONSTANTS.PROJECT_VO_STATUS.WAITING_APPROVAL,
			CONSTANTS.PROJECT_VO_STATUS.CANCELLED,
		]);

		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectVOHandler.handleGetApproval( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.put(
	'/approve/:id',
	validateRoleRequest( [
		'CEO', 'PM',
		'PROCUREMENT_MANAGER', 'SALE',
	] ),
	async ( req, res, next ) => {
		try {
			req.checkBody( 'user_id' ).notEmpty();
			req.checkBody( 'status' ).notEmpty().isIn([
				CONSTANTS.VO_APPROVE_STATUS.APPROVED,
				CONSTANTS.VO_APPROVE_STATUS.REJECTED,
			]);

			// Validate body
			await Validator.validate( req );

			const result = await req.ProjectVOHandler.handleApprove( +req.params.id, req.body );

			// Destroy cache
			ApiCache.destroy( res );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.delete( '/delete/:id', validateRoleRequest( [ 'QS' ] ), async ( req, res, next ) => {
	try {
		const result = await req.ProjectVOHandler.handleDelete( +req.params.id );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

module.exports = router;
