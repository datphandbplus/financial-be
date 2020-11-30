const express = require( 'express' );
const _ = require( 'underscore' );

const {
	Account, ApiCache,
	Authentication, Validator,
} = require( '@helpers' );

const { STATUS_CODE } = require( '@resources' );

const router = express.Router();

router.use( '/', ( req, res, next ) => {
	const channelId = res.locals.channel_id;
	const userData = res.locals.user_data;

	req.Account = new Account( userData );
	req.Authentication = new Authentication( channelId );
	next();
} );

router.get(
	'/',
	ApiCache.cache(),
	( req, res, next ) => {
		res.status( STATUS_CODE.OK );

		const userData = res.locals.user_data;

		if ( !userData ) {
			res.json( {} );
			return;
		}

		const availableApps = res.locals.channel_data
			&& _.map( res.locals.channel_data.channel_apps, 'name' );

		userData.available_apps = availableApps;
		if ( userData.dataValues ) userData.dataValues.available_apps = availableApps;

		res.json( userData );
	}
);

router.put( '/change-password', async ( req, res, next ) => {
	try {
		req.checkBody( 'current_password' ).notEmpty();
		req.checkBody( 'new_password' ).notEmpty();

		// Validate body
		await Validator.validate( req );

		const result = await req.Authentication
		.changePassword( res.locals.user_id, req.body.current_password, req.body.new_password );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.put( '/update-avatar', async ( req, res, next ) => {
	try {
		req.checkBody( 'avatar' ).notEmpty();

		// Validate body
		await Validator.validate( req );

		const result = await req.Account.updateAvatar( res.locals.channel_id, req.body.avatar );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.post( '/upload-avatar', async ( req, res, next ) => {
	try {
		const result = await req.Account.uploadAvatar( res.locals.channel_id, req, res );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

module.exports = router;
