const express = require( 'express' );
const _ = require( 'underscore' );

const ProjectBillHandler = require( '@handlers/finance/project/project_bill' );

const { ApiCache, Validator } = require( '@helpers' );
const { validateRoleRequest } = require( '@middlewares' );
const { STATUS_CODE, CONSTANTS } = require( '@resources' );

const router = express.Router();

router.use( '/', ( req, res, next ) => {
	const channelId = res.locals.channel_id;
	const userData = res.locals.user_data;

	req.ProjectBillHandler = new ProjectBillHandler( channelId, userData );
	next();
} );

router.get(
	'/list',
	ApiCache.cache( CONSTANTS.API_CACHE_EXPIRE ),
	validateRoleRequest([
		'CEO', 'CFO', 'GENERAL_ACCOUNTANT',
		'LIABILITIES_ACCOUNTANT', 'PROCUREMENT_MANAGER',
		'CONSTRUCTION_MANAGER', 'PM',
	]),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectBillHandler.handleGetAll( req.query );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.post( '/create', validateRoleRequest( [ 'PM' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'project_id' ).notEmpty();
		req.checkBody( 'name' ).notEmpty().isLength( { min: 1, max: 255 } );
		req.checkBody( 'total' ).notEmpty().isFloat( { min: 0 } );
		req.checkBody( 'total_vat' ).notEmpty().isFloat( { min: 0 } );
		req.checkBody( 'expected_invoice_date' ).notEmpty();
		req.checkBody( 'transfer_type' ).notEmpty().isIn( _.values( CONSTANTS.TRANSFER_TYPE ) );

		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectBillHandler.handleCreate( req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.put( '/update/:id', validateRoleRequest( [ 'PM' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'name' ).notEmpty().isLength( { min: 1, max: 255 } );
		req.checkBody( 'total' ).notEmpty().isFloat( { min: 0 } );
		req.checkBody( 'total_vat' ).notEmpty().isFloat( { min: 0 } );
		req.checkBody( 'expected_invoice_date' ).notEmpty();

		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectBillHandler.handleUpdate( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.put( '/update-invoice/:id', validateRoleRequest( [ 'CFO', 'LIABILITIES_ACCOUNTANT' ] ),
	async ( req, res, next ) => {
		try {
			req.checkBody( 'invoice_number' ).notEmpty().isLength( { min: 1, max: 255 } );
			req.checkBody( 'invoice_date' ).notEmpty();

			// Validate body
			await Validator.validate( req );

			const result = await req.ProjectBillHandler.handleUpdateInvoice( +req.params.id, req.body );

			// Destroy cache
			ApiCache.destroy( res );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.put( '/update-status/:id', validateRoleRequest( [ 'LIABILITIES_ACCOUNTANT' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'status' ).notEmpty().isIn( _.values( CONSTANTS.BILL_STATUS ) );

		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectBillHandler.handleUpdateStatus( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.put( '/update-finance-note/:id', validateRoleRequest( [ 'LIABILITIES_ACCOUNTANT' ] ), async ( req, res, next ) => {
	try {
		const result = await req.ProjectBillHandler.handleUpdateFinanceNote( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.put( '/update-procedures/:id', validateRoleRequest( [ 'PM' ] ), async ( req, res, next ) => {
	try {
		req.checkBody().notEmpty().isArrayLength( { min: 1 } );
		req.checkBody( '*.name' ).notEmpty().isLength( { min: 1, max: 255 } );
		req.checkBody( '*.status' ).notEmpty().isIn( _.values( CONSTANTS.PROCEDURE_STATUS ) );
		req.checkBody( '*.deadline' ).notEmpty();
		req.checkBody( '*.created_at' ).notEmpty();

		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectBillHandler.handleUpdateProcedures( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.delete( '/delete/:id', validateRoleRequest( [ 'PM' ] ), async ( req, res, next ) => {
	try {
		const result = await req.ProjectBillHandler.handleDelete( +req.params.id );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.post(
	'/download-invoice',
	validateRoleRequest([
		'CEO', 'CFO', 'GENERAL_ACCOUNTANT',
		'LIABILITIES_ACCOUNTANT', 'PROCUREMENT_MANAGER', 'CONSTRUCTION_MANAGER',
		'PM', 'PURCHASING',
	]),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectBillHandler.handleDownloadInvoice( req.body );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.post(
	'/download-procedure',
	validateRoleRequest([
		'CEO', 'CFO', 'GENERAL_ACCOUNTANT',
		'LIABILITIES_ACCOUNTANT', 'PROCUREMENT_MANAGER', 'CONSTRUCTION_MANAGER',
		'PM', 'PURCHASING',
	]),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectBillHandler.handleDownloadProcedure( req.body );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

module.exports = router;
