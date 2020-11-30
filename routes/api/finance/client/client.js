const express = require( 'express' );

const ClientHandler = require( '@handlers/finance/client/client' );

const { ApiCache, Validator } = require( '@helpers' );
const { validateRoleRequest } = require( '@middlewares' );
const { STATUS_CODE } = require( '@resources' );

const router = express.Router();

router.use( '/', ( req, res, next ) => {
	const channelId = res.locals.channel_id;
	const userData = res.locals.user_data;

	req.ClientHandler = new ClientHandler( channelId, userData );
	next();
} );

router.get(
	'/external/list',
	ApiCache.cache(),
	validateRoleRequest( [ 'CEO', 'ADMIN', 'PROCUREMENT_MANAGER' ] ),
	async ( req, res, next ) => {
		try {
			const result = await req.ClientHandler.handleGetAllExternal();

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.get(
	'/list',
	ApiCache.cache(),
	validateRoleRequest( [
		'CEO', 'ADMIN', 'PROCUREMENT_MANAGER',
		'PM', 'SALE',
	] ),
	async ( req, res, next ) => {
		try {
			const result = await req.ClientHandler.handleGetAll( req.query );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.post( '/create', validateRoleRequest( [ 'CEO', 'ADMIN', 'PROCUREMENT_MANAGER' ] ), async ( req, res, next ) => {
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

		const result = await req.ClientHandler.handleCreate( req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

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

		const result = await req.ClientHandler.handleUpdate( +req.params.id, req.body );

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
		const result = await req.ClientHandler.handleSoftDelete( +req.params.id );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

module.exports = router;
