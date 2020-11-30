const express = require( 'express' );

const LineItemCategoryHandler = require( '@handlers/finance/line_item_category/line_item_category' );

const { ApiCache, Validator } = require( '@helpers' );
const { validateRoleRequest } = require( '@middlewares' );
const { STATUS_CODE } = require( '@resources' );

const router = express.Router();

router.use( '/', ( req, res, next ) => {
	const channelId = res.locals.channel_id;
	const userData = res.locals.user_data;

	req.LineItemCategoryHandler = new LineItemCategoryHandler( channelId, userData );
	next();
} );

router.get(
	'/list',
	ApiCache.cache(),
	async ( req, res, next ) => {
		try {
			const result = await req.LineItemCategoryHandler.handleGetAll( req.query );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.post( '/create', validateRoleRequest( [ 'CEO', 'PROCUREMENT_MANAGER' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'name' ).notEmpty().isLength( { min: 1, max: 255 } );

		// Validate body
		await Validator.validate( req );

		const result = await req.LineItemCategoryHandler.handleCreate( req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.put( '/update/:id', validateRoleRequest( [ 'CEO', 'PROCUREMENT_MANAGER' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'name' ).notEmpty().isLength( { min: 1, max: 255 } );

		// Validate body
		await Validator.validate( req );

		const result = await req.LineItemCategoryHandler.handleUpdate( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.delete( '/delete/:id', validateRoleRequest( [ 'CEO', 'PROCUREMENT_MANAGER' ] ), async ( req, res, next ) => {
	try {
		const result = await req.LineItemCategoryHandler.handleDelete( +req.params.id );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

module.exports = router;
