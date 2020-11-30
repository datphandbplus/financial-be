const express = require( 'express' );

const ProjectLineItemHandler = require( '@handlers/finance/project/project_line_item' );
// const ProjectPermissions = require( '@handlers/finance/project/permissions_project' );

const { ApiCache, Validator, Uploader } = require( '@helpers' );
const { validateRoleRequest } = require( '@middlewares' );
const { STATUS_CODE, CONSTANTS } = require( '@resources' );

const router = express.Router();

router.use( '/', ( req, res, next ) => {
	const channelId = res.locals.channel_id;
	const userData = res.locals.user_data;

	// req.ProjectPermissions = new ProjectPermissions( channelId, userData );
	req.ProjectLineItemHandler = new ProjectLineItemHandler( channelId, userData );
	req.Uploader = new Uploader( channelId );
	next();
} );

router.get(
	'/list',
	ApiCache.cache( CONSTANTS.API_CACHE_EXPIRE ),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectLineItemHandler.handleGetAll( req.query );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.post( '/create', validateRoleRequest( [ 'QS' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'group' ).isLength( { min: 0, max: 255 } );
		req.checkBody( 'child_group' ).isLength( { min: 0, max: 255 } );
		req.checkBody( 'price' ).notEmpty().isFloat( { min: 0 } );
		req.checkBody( 'unit' ).notEmpty().isLength( { min: 1, max: 255 } );
		req.checkBody( 'amount' ).notEmpty().isFloat( { min: 0 } );

		// Validate body
		await Validator.validate( req );

		// await req.ProjectPermissions._checkProjectPermissionByRequest(req.body, CONSTANTS.PROJECT_STATUS.DONE);
		const result = await req.ProjectLineItemHandler.handleCreate( req.body );

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
		req.checkBody( 'group' ).isLength( { min: 0, max: 255 } );
		req.checkBody( 'child_group' ).isLength( { min: 0, max: 255 } );
		req.checkBody( 'price' ).notEmpty().isFloat( { min: 0 } );
		req.checkBody( 'unit' ).notEmpty().isLength( { min: 1, max: 255 } );
		req.checkBody( 'amount' ).notEmpty().isFloat( { min: 0 } );

		// Validate body
		await Validator.validate( req );

		// await req.ProjectPermissions._checkProjectPermissionByRequest(req.body, CONSTANTS.PROJECT_STATUS.DONE);
		const result = await req.ProjectLineItemHandler.handleUpdate( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.put( '/update-priority', validateRoleRequest( [ 'QS' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'project_sheet_id' ).notEmpty();
		req.checkBody( 'list.*.id' ).notEmpty();

		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectLineItemHandler
		.handleUpdatePriority( req.body.project_sheet_id, req.body.list );

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
		const result = await req.ProjectLineItemHandler.handleDownloadImportFile();

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.post( '/upload', validateRoleRequest( [ 'QS' ] ), async ( req, res, next ) => {
	try {
		const result = await req.ProjectLineItemHandler.handleUploadImportFile( req, res, req.query );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.post( '/upload-image', validateRoleRequest( [ 'QS' ] ), async ( req, res, next ) => {
	try {
		const result = await req.Uploader.upload( req, res, 'line-item-images' );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.delete( '/delete/:id', validateRoleRequest( [ 'QS' ] ), async ( req, res, next ) => {
	try {
		const result = await req.ProjectLineItemHandler.handleDelete( +req.params.id );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

module.exports = router;
