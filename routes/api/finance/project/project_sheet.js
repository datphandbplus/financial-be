const express = require( 'express' );

const ProjectSheetHandler = require( '@handlers/finance/project/project_sheet' );

const { ApiCache, Validator } = require( '@helpers' );
const { validateRoleRequest } = require( '@middlewares' );
const { STATUS_CODE, CONSTANTS } = require( '@resources' );

const router = express.Router();

router.use( '/', ( req, res, next ) => {
	const channelId = res.locals.channel_id;
	const userData = res.locals.user_data;

	req.ProjectSheetHandler = new ProjectSheetHandler( channelId, userData );
	next();
} );

router.get(
	'/list',
	validateRoleRequest( [
		'PROCUREMENT_MANAGER', 'CONSTRUCTION_MANAGER', 'CFO',
		'GENERAL_ACCOUNTANT', 'LIABILITIES_ACCOUNTANT', 'CEO',
		'PM', 'QS', 'PURCHASING',
		'SALE', 'CONSTRUCTION',
	] ),
	ApiCache.cache( CONSTANTS.API_CACHE_EXPIRE ),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectSheetHandler.handleGetAll( req.query );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.post( '/create', validateRoleRequest( [ 'QS' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'project_id' ).notEmpty();
		req.checkBody( 'name' ).notEmpty().isLength( { min: 1, max: 255 } );

		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectSheetHandler.handleCreate( req.body );

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
		req.checkBody( 'project_id' ).notEmpty();
		req.checkBody( 'name' ).notEmpty().isLength( { min: 1, max: 255 } );

		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectSheetHandler.handleUpdate( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.delete( '/delete/:id', validateRoleRequest( [ 'QS' ] ), async ( req, res, next ) => {
	try {
		const result = await req.ProjectSheetHandler.handleDelete( +req.params.id );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

module.exports = router;
