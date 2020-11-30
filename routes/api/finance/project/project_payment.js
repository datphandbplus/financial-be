const express = require( 'express' );
const _ = require( 'underscore' );

const ProjectPaymentHandler = require( '@handlers/finance/project/project_payment' );

const { ApiCache, Validator } = require( '@helpers' );
const { validateRoleRequest } = require( '@middlewares' );
const { STATUS_CODE, CONSTANTS } = require( '@resources' );

const router = express.Router();

router.use( '/', ( req, res, next ) => {
	const channelId = res.locals.channel_id;
	const userData = res.locals.user_data;

	req.ProjectPaymentHandler = new ProjectPaymentHandler( channelId, userData );
	next();
} );

router.get(
	'/list',
	ApiCache.cache( CONSTANTS.API_CACHE_EXPIRE ),
	validateRoleRequest([
		'CEO', 'CFO', 'GENERAL_ACCOUNTANT',
		'LIABILITIES_ACCOUNTANT', 'PROCUREMENT_MANAGER', 'CONSTRUCTION_MANAGER',
		'PM', 'PURCHASING', 'CONSTRUCTION',
	]),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectPaymentHandler.handleGetAll( req.query );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.post(
	'/create',
	validateRoleRequest( [ 'PURCHASING' ] ),
	async ( req, res, next ) => {
		try {
			req.checkBody( 'project_id' ).notEmpty();
			req.checkBody( 'project_purchase_order_id' ).notEmpty();
			req.checkBody( 'total' ).notEmpty().isFloat( { min: 1 } );
			req.checkBody( 'total_vat' ).notEmpty().isFloat( { min: 0 } );
			req.checkBody( 'name' ).notEmpty().isLength( { min: 1, max: 255 } );
			req.checkBody( 'invoice_number' ).isLength( { max: 255 } );
			req.checkBody( 'invoice_date' ).notEmpty();
			req.checkBody( 'transfer_type' ).notEmpty().isIn( _.values( CONSTANTS.TRANSFER_TYPE ) );

			// Validate body
			await Validator.validate( req );

			const result = await req.ProjectPaymentHandler.handleCreate( req.body );

			// Destroy cache
			ApiCache.destroy( res );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.put(
	'/update-invoice/:id',
	validateRoleRequest( [ 'PURCHASING' ] ),
	async ( req, res, next ) => {
		try {
			req.checkBody( 'invoice_number' ).notEmpty().isLength( { min: 1, max: 255 } );
			req.checkBody( 'invoice_date' ).notEmpty();

			// Validate body
			await Validator.validate( req );

			const result = await req.ProjectPaymentHandler.handleUpdateInvoice( +req.params.id, req.body );

			// Destroy cache
			ApiCache.destroy( res );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.put(
	'/update-payment-order/:id',
	validateRoleRequest( [ 'CFO', 'LIABILITIES_ACCOUNTANT' ] ),
	async ( req, res, next ) => {
		try {
			req.checkBody( 'payment_order_number' ).notEmpty().isLength( { min: 1, max: 255 } );
			req.checkBody( 'payment_order_date' ).notEmpty();

			// Validate body
			await Validator.validate( req );

			const result = await req.ProjectPaymentHandler.handleUpdatePaymentOrder( +req.params.id, req.body );

			// Destroy cache
			ApiCache.destroy( res );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.put( '/update-status/:id',
	validateRoleRequest( [ 'LIABILITIES_ACCOUNTANT' ] ),
	async ( req, res, next ) => {
		try {
			req.checkBody( 'status' ).notEmpty().isIn( _.values( CONSTANTS.PAYMENT_STATUS ) );

			// Validate body
			await Validator.validate( req );

			const result = await req.ProjectPaymentHandler.handleUpdateStatus( +req.params.id, req.body );

			// Destroy cache
			ApiCache.destroy( res );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.put( '/update-approve-status/:id',
	validateRoleRequest( [
		'CEO', 'PURCHASING', 'PROCUREMENT_MANAGER',
		'CFO', 'GENERAL_ACCOUNTANT',
	] ),
	async ( req, res, next ) => {
		req.checkBody( 'status' ).notEmpty().isIn( _.values( CONSTANTS.PAYMENT_APPROVE_STATUS ) );

		try {
			// Validate body
			await Validator.validate( req );

			const result = await req.ProjectPaymentHandler.handleUpdateApproveStatus( +req.params.id, req.body );

			// Destroy cache
			ApiCache.destroy( res );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.put( '/update-finance-note/:id', validateRoleRequest( [ 'LIABILITIES_ACCOUNTANT' ] ),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectPaymentHandler.handleUpdateFinanceNote( +req.params.id, req.body );

			// Destroy cache
			ApiCache.destroy( res );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.put( '/update-procedures/:id', validateRoleRequest( [ 'PURCHASING' ] ), async ( req, res, next ) => {
	req.checkBody().notEmpty().isArrayLength( { min: 1 } );
	req.checkBody( '*.name' ).notEmpty().isLength( { min: 1, max: 255 } );
	req.checkBody( '*.status' ).notEmpty().isIn( _.values( CONSTANTS.PROCEDURE_STATUS ) );
	req.checkBody( '*.deadline' ).notEmpty();
	req.checkBody( '*.created_at' ).notEmpty();

	try {
		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectPaymentHandler.handleUpdateProcedures( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.delete(
	'/delete/:id',
	validateRoleRequest([ 'PURCHASING' ]),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectPaymentHandler.handleDelete( +req.params.id );

			// Destroy cache
			ApiCache.destroy( res );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.post(
	'/download-invoice',
	validateRoleRequest([
		'CEO', 'CFO', 'GENERAL_ACCOUNTANT',
		'LIABILITIES_ACCOUNTANT', 'PROCUREMENT_MANAGER', 'CONSTRUCTION_MANAGER',
		'PM', 'PURCHASING',
	]),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectPaymentHandler.handleDownloadInvoice( req.body );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.post(
	'/download-payment-order',
	validateRoleRequest([
		'CEO', 'CFO', 'GENERAL_ACCOUNTANT',
		'LIABILITIES_ACCOUNTANT', 'PROCUREMENT_MANAGER', 'CONSTRUCTION_MANAGER',
		'PM', 'PURCHASING',
	]),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectPaymentHandler.handleDownloadPaymentOrder( req.body );

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
			const result = await req.ProjectPaymentHandler.handleDownloadProcedure( req.body );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.get(
	'/total-po',
	ApiCache.cache( CONSTANTS.API_CACHE_EXPIRE ),
	validateRoleRequest([
		'CEO', 'CFO', 'GENERAL_ACCOUNTANT',
		'LIABILITIES_ACCOUNTANT', 'PROCUREMENT_MANAGER', 'CONSTRUCTION_MANAGER',
		'PM', 'PURCHASING',
	]),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectPaymentHandler.handleGetTotalPO( req.query );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

module.exports = router;
