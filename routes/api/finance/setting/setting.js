const express = require( 'express' );

const SettingHandler = require( '@handlers/finance/setting/setting' );

const { ApiCache, Uploader, Validator } = require( '@helpers' );
const { validateRoleRequest } = require( '@middlewares' );
const { STATUS_CODE } = require( '@resources' );

const router = express.Router();

router.use( '/', ( req, res, next ) => {
	const channelId = res.locals.channel_id;
	const userData = res.locals.user_data;

	req.SettingHandler = new SettingHandler( channelId, userData );
	req.Uploader = new Uploader( channelId );
	next();
} );

router.get(
	'/list',
	ApiCache.cache(),
	async ( req, res, next ) => {
		try {
			const result = await req.SettingHandler.handleGetAll( req.query );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.put( '/update', validateRoleRequest( [ 'CEO', 'ADMIN' ] ), async ( req, res, next ) => {
	try {
		req.checkBody().notEmpty().isArrayLength( { min: 1 } );
		req.checkBody( '*.key' ).notEmpty().isLength( { min: 1, max: 255 } );

		// Validate body
		await Validator.validate( req );

		const result = await req.SettingHandler.handleBulkUpdate( req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.post( '/upload-logo', validateRoleRequest( [ 'CEO', 'ADMIN' ] ), async ( req, res, next ) => {
	try {
		const result = await req.Uploader.upload( req, res, 'logos' );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

module.exports = router;
