const express = require( 'express' );

const ProjectPurchaseOrderHandler = require( '@handlers/finance/project/project_purchase_order' );

const { ApiCache, Validator } = require( '@helpers' );
const { validateRoleRequest } = require( '@middlewares' );
const { STATUS_CODE, CONSTANTS } = require( '@resources' );

const router = express.Router();

router.use( '/', ( req, res, next ) => {
	const channelId = res.locals.channel_id;
	const userData = res.locals.user_data;

	req.ProjectPurchaseOrderHandler = new ProjectPurchaseOrderHandler( channelId, userData );
	next();
} );

router.get(
	'/list',
	ApiCache.cache( CONSTANTS.API_CACHE_EXPIRE ),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectPurchaseOrderHandler.handleGetAll( req.query );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.get(
	'/:id',
	ApiCache.cache( CONSTANTS.API_CACHE_EXPIRE ),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectPurchaseOrderHandler.handleGetOne( +req.params.id, req.query );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.post( '/create', validateRoleRequest( [ 'PURCHASING' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'vendor_id' ).notEmpty();
		req.checkBody( 'project_id' ).notEmpty();
		req.checkBody( 'vat_percent' ).notEmpty().isFloat( { min: 0, max: 100 } );
		req.checkBody( 'discount_amount' ).notEmpty().isFloat( { min: 0 } );
		req.checkBody( 'discount_type' ).notEmpty().isIn( [ '%', '$' ] );
		req.checkBody( 'name' ).notEmpty().isLength( { min: 1, max: 255 } );
		req.checkBody( 'selected_cost_items.*.id' ).notEmpty().isLength( { min: 1, max: 255 } );

		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectPurchaseOrderHandler.handleCreate( req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.put( '/update/:id', validateRoleRequest( [ 'PURCHASING' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'name' ).notEmpty().isLength( { min: 1, max: 255 } );
		req.checkBody( 'vat_percent' ).notEmpty().isFloat( { min: 0, max: 100 } );
		req.checkBody( 'discount_amount' ).notEmpty().isFloat( { min: 0 } );
		req.checkBody( 'discount_type' ).notEmpty().isIn( [ '%', '$' ] );
		req.checkBody( 'selected_cost_items.*.id' ).notEmpty().isLength( { min: 1, max: 255 } );

		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectPurchaseOrderHandler.handleUpdate( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.put( '/modify/:id', validateRoleRequest( [ 'PURCHASING' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'name' ).notEmpty().isLength( { min: 1, max: 255 } );
		req.checkBody( 'vat_percent' ).notEmpty().isFloat( { min: 0, max: 100 } );
		req.checkBody( 'discount_amount' ).notEmpty().isFloat( { min: 0 } );
		req.checkBody( 'discount_type' ).notEmpty().isIn( [ '%', '$' ] );
		req.checkBody( 'selected_cost_items.*.id' ).notEmpty().isLength( { min: 1, max: 255 } );
		req.checkBody( 'selected_cost_items.*.amount' ).notEmpty().isFloat( { min: 0 } );
		req.checkBody( 'selected_cost_items.*.price' ).notEmpty().isFloat( { min: 0 } );
		req.checkBody( 'selected_cost_items.*.project_id' ).notEmpty();
		req.checkBody( 'selected_cost_items.*.vendor_id' ).notEmpty();

		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectPurchaseOrderHandler.handleModify( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.put( '/change-status/:id', validateRoleRequest( [ 'PURCHASING' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'status' ).notEmpty().isInt( { min: 0, max: 6 } );

		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectPurchaseOrderHandler.handleChangeStatus( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.put( '/change-freeze/:id', validateRoleRequest( [ 'CEO' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'status' ).notEmpty().isIn([ CONSTANTS.PURCHASE_ORDER_STATUS.FREEZED, CONSTANTS.PURCHASE_ORDER_STATUS.DEFROST ]);

		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectPurchaseOrderHandler.handleChangeFreeze( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.delete(
	'/delete/:id',
	validateRoleRequest( [ 'PURCHASING' ] ),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectPurchaseOrderHandler.handleDelete( +req.params.id );

			// Destroy cache
			ApiCache.destroy( res );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

module.exports = router;
