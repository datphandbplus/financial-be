const express = require( 'express' );

const ProjectCostItemHandler = require( '@handlers/finance/project/project_cost_item' );

const { ApiCache, Validator } = require( '@helpers' );
const { validateRoleRequest } = require( '@middlewares' );
const { STATUS_CODE } = require( '@resources' );

const router = express.Router();

router.use( '/', ( req, res, next ) => {
	const channelId = res.locals.channel_id;
	const userData = res.locals.user_data;

	req.ProjectCostItemHandler = new ProjectCostItemHandler( channelId, userData );
	next();
} );

router.get(
	'/list',
	validateRoleRequest([
		'QS', 'PURCHASING', 'PROCUREMENT_MANAGER',
		'PM', 'CEO', 'CFO',
		'CONSTRUCTION_MANAGER', 'CONSTRUCTION',
	]),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectCostItemHandler.handleGetAll( req.query );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.post( '/create', validateRoleRequest( [ 'QS', 'PURCHASING' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'project_id' ).notEmpty();
		req.checkBody( 'name' ).notEmpty().isLength( { min: 1, max: 255 } );
		req.checkBody( 'unit' ).notEmpty().isLength( { min: 1, max: 255 } );
		req.checkBody( 'amount' ).notEmpty().isFloat( { min: 0 } );
		req.checkBody( 'price' ).notEmpty().isFloat( { min: 0 } );

		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectCostItemHandler.handleCreate( req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.put( '/update/:id', validateRoleRequest( [ 'QS', 'PURCHASING', 'PROCUREMENT_MANAGER' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'project_id' ).notEmpty();
		req.checkBody( 'name' ).notEmpty().isLength( { min: 1, max: 255 } );
		req.checkBody( 'unit' ).notEmpty().isLength( { min: 1, max: 255 } );
		req.checkBody( 'amount' ).notEmpty().isFloat( { min: 0 } );
		req.checkBody( 'price' ).notEmpty().isFloat( { min: 0 } );

		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectCostItemHandler.handleUpdate( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.put( '/update-vendor/:id', validateRoleRequest( [ 'QS', 'PURCHASING' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'vendor_id' ).notEmpty();

		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectCostItemHandler.handleUpdateVendor( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.get( '/download', validateRoleRequest( [ 'QS' ] ), async ( req, res, next ) => {
	try {
		const result = await req.ProjectCostItemHandler.handleDownloadImportFile();

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.post( '/upload', validateRoleRequest( [ 'QS', 'PURCHASING' ] ), async ( req, res, next ) => {
	try {
		const result = await req.ProjectCostItemHandler.handleUploadImportFile( req, res, req.query );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.delete( '/delete/:id', validateRoleRequest( [ 'QS', 'PURCHASING' ] ), async ( req, res, next ) => {
	try {
		const result = await req.ProjectCostItemHandler.handleDelete( +req.params.id );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

module.exports = router;
