const express = require( 'express' );

const VendorHandler = require( '@handlers/finance/vendor/vendor' );

const { ApiCache, Validator } = require( '@helpers' );
const { validateRoleRequest } = require( '@middlewares' );
const { STATUS_CODE } = require( '@resources' );

const router = express.Router();

router.use( '/', ( req, res, next ) => {
	const channelId = res.locals.channel_id;
	const userData = res.locals.user_data;

	req.VendorHandler = new VendorHandler( channelId, userData );
	next();
} );

router.get(
	'/list',
	ApiCache.cache(),
	async ( req, res, next ) => {
		try {
			const result = await req.VendorHandler.handleGetAll( req.query );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.post(
	'/create',
	validateRoleRequest( [
		'CEO', 'ADMIN',
		'PROCUREMENT_MANAGER', 'CONSTRUCTION_MANAGER',
	] ),
	async ( req, res, next ) => {
		try {
			req.checkBody( 'name' ).notEmpty().isLength( { min: 1, max: 255 } );
			req.checkBody( 'short_name' ).notEmpty().isLength( { min: 1, max: 255 } );
			req.checkBody( 'phone' ).notEmpty().isLength( { min: 1, max: 255 } );
			req.checkBody( 'tax' ).isLength( { min: 0, max: 255 } );
			req.checkBody( 'address' ).isLength( { min: 0, max: 255 } );
			req.checkBody( 'bank_name' ).isLength( { min: 0, max: 255 } );
			req.checkBody( 'bank_province' ).isLength( { min: 0, max: 255 } );
			req.checkBody( 'bank_branch' ).isLength( { min: 0, max: 255 } );
			req.checkBody( 'bank_account_number' ).isLength( { min: 0, max: 255 } );
			req.checkBody( 'payment_term' ).notEmpty().isInt( { min: 0 } );
			req.checkBody( 'contact_list.*' ).notEmpty().isLength( { min: 1, max: 255 } );

			// Validate body
			await Validator.validate( req );

			const result = await req.VendorHandler.handleCreate( req.body );

			// Destroy cache
			ApiCache.destroy( res );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.put( '/update/:id', validateRoleRequest( [ 'CEO', 'ADMIN', 'PROCUREMENT_MANAGER' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'name' ).notEmpty().isLength( { min: 1, max: 255 } );
		req.checkBody( 'short_name' ).notEmpty().isLength( { min: 1, max: 255 } );
		req.checkBody( 'phone' ).notEmpty().isLength( { min: 1, max: 255 } );
		req.checkBody( 'tax' ).isLength( { min: 0, max: 255 } );
		req.checkBody( 'address' ).isLength( { min: 0, max: 255 } );
		req.checkBody( 'bank_name' ).isLength( { min: 0, max: 255 } );
		req.checkBody( 'bank_province' ).isLength( { min: 0, max: 255 } );
		req.checkBody( 'bank_branch' ).isLength( { min: 0, max: 255 } );
		req.checkBody( 'bank_account_number' ).isLength( { min: 0, max: 255 } );
		req.checkBody( 'payment_term' ).notEmpty().isInt( { min: 0 } );
		req.checkBody( 'is_disabled' ).notEmpty().isBoolean();
		req.checkBody( 'contact_list.*' ).notEmpty().isLength( { min: 1, max: 255 } );

		// Validate body
		await Validator.validate( req );

		const result = await req.VendorHandler.handleUpdate( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.delete( '/delete/:id', validateRoleRequest( [ 'CEO', 'ADMIN', 'PROCUREMENT_MANAGER' ] ), async ( req, res, next ) => {
	try {
		const result = await req.VendorHandler.handleSoftDelete( +req.params.id );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

module.exports = router;
