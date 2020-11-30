const express = require( 'express' );

const UserHandler = require( '@handlers/finance/user/user' );

const { ApiCache, Validator } = require( '@helpers' );
const { validateRoleRequest } = require( '@middlewares' );
const { STATUS_CODE, REGEXES } = require( '@resources' );

const router = express.Router();

router.use( '/', ( req, res, next ) => {
	const channelId = res.locals.channel_id;
	const userData = res.locals.user_data;

	req.UserHandler = new UserHandler( channelId, userData );
	next();
} );

router.get(
	'/external/list',
	ApiCache.cache(),
	validateRoleRequest( [ 'CEO', 'ADMIN' ] ),
	async ( req, res, next ) => {
		try {
			const result = await req.UserHandler.handleGetAllExternal();

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
	validateRoleRequest( [ 'CEO', 'ADMIN', 'SALE' ] ),
	async ( req, res, next ) => {
		try {
			const result = await req.UserHandler.handleGetAll( req.query );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.post( '/create', validateRoleRequest( [ 'CEO', 'ADMIN' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'role_key' ).notEmpty().isLength( { min: 1, max: 255 } );
		req.checkBody( 'full_name' ).notEmpty().isLength( { min: 1, max: 255 } );
		req.checkBody( 'is_send_activation' ).notEmpty().isBoolean();
		req.checkBody( 'email' ).notEmpty().matches( REGEXES.EMAIL ).isLength( { min: 1, max: 255 } );

		// Validate body
		await Validator.validate( req );

		const result = await req.UserHandler.handleCreate( req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.put( '/update/:id', validateRoleRequest( [ 'CEO', 'ADMIN' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'role_key' ).notEmpty().isLength( { min: 1, max: 255 } );
		req.checkBody( 'full_name' ).notEmpty().isLength( { min: 1, max: 255 } );

		// Validate body
		await Validator.validate( req );

		const result = await req.UserHandler.handleUpdate( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.put( '/toggle-status/:id', validateRoleRequest( [ 'CEO', 'ADMIN' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'is_disabled' ).notEmpty().isBoolean();

		// Validate body
		await Validator.validate( req );

		const result = await req.UserHandler.handleToggleStatus( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.delete( '/delete/:id', validateRoleRequest( [ 'CEO', 'ADMIN' ] ), async ( req, res, next ) => {
	try {
		const result = await req.UserHandler.handleDelete( +req.params.id );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.put( '/send-activation-email/:id', validateRoleRequest( [ 'CEO', 'ADMIN' ] ), async ( req, res, next ) => {
	try {
		const result = await req.UserHandler.handleSendActivationEmail( +req.params.id );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

module.exports = router;
