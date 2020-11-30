const express = require( 'express' );

const { Authentication, Validator } = require( '@helpers' );
const { STATUS_CODE, REGEXES } = require( '@resources' );

const router = express.Router();

router.use( '/', ( req, res, next ) => {
	const channelId = res.locals.channel_id;

	req.Authentication = new Authentication( channelId );
	next();
} );

router.post( '/login', async ( req, res, next ) => {
	try {
		req.checkBody( 'email' )
		.notEmpty()
		.matches( REGEXES.EMAIL )
		.isLength( { min: 1, max: 255 } );
		req.checkBody( 'password' ).notEmpty();

		// Validate body
		await Validator.validate( req );

		const result = await req.Authentication.login( res.locals.channel_token, req.body );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.post( '/forgot-password', async ( req, res, next ) => {
	try {
		req.checkBody( 'email' )
		.notEmpty()
		.matches( REGEXES.EMAIL )
		.isLength( { min: 1, max: 255 } );

		// Validate body
		await Validator.validate( req );

		const result = await req.Authentication.forgotPassword( req.body );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

module.exports = router;
