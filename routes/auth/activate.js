const express = require( 'express' );

const { Authentication, Validator } = require( '@helpers' );
const { STATUS_CODE, STATUS_MESSAGE } = require( '@resources' );

const router = express.Router();

router.get( '/check', async ( req, res, next ) => {
	try {
		const token = req.query.token;

		if ( !token ) {
			res.status( STATUS_CODE.BAD_REQUEST );
			res.json( STATUS_MESSAGE.BAD_REQUEST );
			return;
		}

		const result = await Authentication.checkActivateToken( token );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.post( '/account', async ( req, res, next ) => {
	try {
		const token = req.query.token;

		if ( !token ) {
			res.status( STATUS_CODE.BAD_REQUEST );
			res.json( STATUS_MESSAGE.BAD_REQUEST );
			return;
		}

		req.checkBody( 'password' ).notEmpty();

		// Validate body
		await Validator.validate( req );

		const result = await Authentication.activateUser( token, req.body.password );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.post( '/reset-password', async ( req, res, next ) => {
	try {
		const token = req.query.token;

		if ( !token ) {
			res.status( STATUS_CODE.BAD_REQUEST );
			res.json( STATUS_MESSAGE.BAD_REQUEST );
			return;
		}

		req.checkBody( 'password' ).notEmpty();

		// Validate body
		await Validator.validate( req );

		const result = await Authentication.resetPassword( token, req.body.password );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

module.exports = router;
