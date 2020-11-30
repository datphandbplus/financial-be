const express = require( 'express' );
const _ = require( 'underscore' );

const ProjectHandler = require( '@handlers/finance/project/project' );
const ProjectExportHandler = require( '@handlers/finance/project/project_export' );
const ProjectUserHandler = require( '@handlers/finance/project/project_user' );
const ProjectStatisticHandler = require( '@handlers/finance/project/project_statistic' );

const { ApiCache, Uploader, Validator } = require( '@helpers' );
const { validateRoleRequest } = require( '@middlewares' );
const { STATUS_CODE, CONSTANTS } = require( '@resources' );

const router = express.Router();

router.use( '/', ( req, res, next ) => {
	const channelId = res.locals.channel_id;
	const userData = res.locals.user_data;

	req.ProjectHandler = new ProjectHandler( channelId, userData );
	req.ProjectExportHandler = new ProjectExportHandler( channelId, userData );
	req.ProjectUserHandler = new ProjectUserHandler( channelId, userData );
	req.ProjectStatisticHandler = new ProjectStatisticHandler( channelId, userData );
	req.Uploader = new Uploader( channelId );
	next();
} );

router.get(
	'/external/list',
	ApiCache.cache( CONSTANTS.API_CACHE_EXPIRE ),
	validateRoleRequest( [ 'CEO', 'SALE' ] ),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectHandler.handleGetAllExternal();

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.get(
	'/list',
	ApiCache.cache( CONSTANTS.API_CACHE_EXPIRE ),
	validateRoleRequest([
		'CEO', 'CFO', 'GENERAL_ACCOUNTANT',
		'LIABILITIES_ACCOUNTANT', 'PROCUREMENT_MANAGER', 'CONSTRUCTION_MANAGER',
		'PM', 'SALE', 'QS',
		'PURCHASING', 'CONSTRUCTION',
	]),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectHandler.handleGetAll( req.query );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.get(
	'/statistic',
	ApiCache.cache( CONSTANTS.API_CACHE_EXPIRE ),
	validateRoleRequest([
		'CEO', 'CFO', 'GENERAL_ACCOUNTANT',
		'LIABILITIES_ACCOUNTANT', 'PROCUREMENT_MANAGER', 'CONSTRUCTION_MANAGER',
		'PM', 'SALE',
		'QS', 'PURCHASING',
	]),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectHandler.handleGetStatistic( req.query );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.get(
	'/dashboard-statistic',
	ApiCache.cache( CONSTANTS.API_CACHE_EXPIRE ),
	validateRoleRequest([
		'CEO', 'CFO', 'GENERAL_ACCOUNTANT',
		'LIABILITIES_ACCOUNTANT', 'PROCUREMENT_MANAGER', 'CONSTRUCTION_MANAGER',
		'PM', 'SALE',
		'QS', 'PURCHASING',
	]),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectHandler.handleGetDashboardStatistic( req.query );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.get(
	'/statistic-rrp',
	ApiCache.cache( CONSTANTS.API_CACHE_EXPIRE ),
	validateRoleRequest([
		'CEO', 'CFO', 'GENERAL_ACCOUNTANT',
		'LIABILITIES_ACCOUNTANT', 'PROCUREMENT_MANAGER', 'CONSTRUCTION_MANAGER',
		'PM', 'SALE',
		'QS', 'PURCHASING',
	]),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectStatisticHandler.handleGetStatisticRRP( req.query );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.get(
	'/dashboard-statistic-rrp',
	ApiCache.cache( CONSTANTS.API_CACHE_EXPIRE ),
	validateRoleRequest([
		'CEO', 'CFO', 'GENERAL_ACCOUNTANT',
		'LIABILITIES_ACCOUNTANT', 'PROCUREMENT_MANAGER', 'CONSTRUCTION_MANAGER',
		'PM', 'SALE',
		'QS', 'PURCHASING',
	]),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectStatisticHandler.handleGetDashboardStatisticRRP( req.query );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.get(
	'/:id',
	ApiCache.cache( CONSTANTS.API_CACHE_EXPIRE ),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectHandler.handleGetOne( +req.params.id, req.query );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.post( '/create', validateRoleRequest( [ 'CEO', 'SALE' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'manage_by' ).notEmpty();
		req.checkBody( 'sale_by' ).notEmpty();
		req.checkBody( 'qs_by' ).notEmpty();
		req.checkBody( 'purchase_by' ).notEmpty();
		req.checkBody( 'client_id' ).notEmpty();
		req.checkBody( 'name' ).notEmpty().isLength( { min: 1, max: 255 } );
		req.checkBody( 'contact' ).notEmpty().isLength( { min: 1, max: 255 } );
		req.checkBody( 'valid_duration' ).notEmpty().isInt( { min: 0 } );
		req.checkBody( 'sheets.*.name' ).notEmpty().isLength( { min: 1, max: 255 } );

		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectHandler.handleCreate( req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.put( '/update/:id', validateRoleRequest( [ 'CEO', 'SALE' ] ), async ( req, res, next ) => {
	try {
		req.checkBody( 'manage_by' ).notEmpty();
		req.checkBody( 'sale_by' ).notEmpty();
		req.checkBody( 'qs_by' ).notEmpty();
		req.checkBody( 'purchase_by' ).notEmpty();
		req.checkBody( 'client_id' ).notEmpty();
		req.checkBody( 'name' ).notEmpty().isLength( { min: 1, max: 255 } );
		req.checkBody( 'contact' ).notEmpty().isLength( { min: 1, max: 255 } );
		req.checkBody( 'valid_duration' ).notEmpty().isInt( { min: 0 } );

		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectHandler.handleUpdate( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.put(
	'/update-quotation-status/:id',
	validateRoleRequest( [
		'CEO', 'PM', 'QS',
		'SALE', 'PROCUREMENT_MANAGER',
	] ),
	async ( req, res, next ) => {
		try {
			req.checkBody( 'quotation_status' ).notEmpty().isIn( _.values( CONSTANTS.QUOTATION_STATUS ) );

			// Validate body
			await Validator.validate( req );

			const result = await req.ProjectHandler.handleUpdateQuotationStatus( +req.params.id, req.body );

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
	'/update-quotation-discount/:id',
	validateRoleRequest( [ 'QS' ] ),
	async ( req, res, next ) => {
		try {
			req.checkBody( 'discount_amount' ).notEmpty().isFloat( { min: 0 } );
			req.checkBody( 'discount_type' ).notEmpty().isIn( [ '%', '$' ] );

			// Validate body
			await Validator.validate( req );

			const result = await req.ProjectHandler.handleUpdateQuotationDiscount( +req.params.id, req.body );

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
	'/update-bill-plan-status/:id',
	validateRoleRequest( [ 'CEO', 'CFO', 'PM' ] ),
	async ( req, res, next ) => {
		req.checkBody( 'bill_plan_status' ).notEmpty().isIn( _.values( CONSTANTS.PLAN_STATUS ) );

		try {
			// Validate body
			await Validator.validate( req );

			const result = await req.ProjectHandler.handleUpdateBillPlanStatus( +req.params.id, req.body );

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
	'/update-payment-plan-status/:id',
	validateRoleRequest( [ 'CEO', 'CFO', 'PM' ] ),
	async ( req, res, next ) => {
		req.checkBody( 'payment_plan_status' ).notEmpty().isIn( _.values( CONSTANTS.PLAN_STATUS ) );

		try {
			// Validate body
			await Validator.validate( req );

			const result = await req.ProjectHandler.handleUpdatePaymentPlanStatus( +req.params.id, req.body );

			// Destroy cache
			ApiCache.destroy( res );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.put( '/update-project-config/:id', validateRoleRequest( [ 'CEO' ] ), async ( req, res, next ) => {
	req.checkBody( 'management_fee' ).notEmpty().isInt( { min: 0 } );
	req.checkBody( 'total_extra_fee' ).notEmpty().isInt( { min: 0 } );
	req.checkBody( 'valid_duration' ).notEmpty().isInt( { min: 0 } );
	req.checkBody( 'extra_cost_fee' ).notEmpty().isInt( { min: 0 } );
	req.checkBody( 'exchange_rate' ).notEmpty().isInt( { min: 0 } );
	req.checkBody( 'exchange_rate' ).notEmpty().isInt( { min: 1 } );
	req.checkBody( 'project_status' ).notEmpty().isIn( _.values( CONSTANTS.PROJECT_STATUS ) );

	try {
		// Validate body
		await Validator.validate( req );

		const result = await req.ProjectHandler.handleUpdateProjectConfig( +req.params.id, req.body );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.post(
	'/upload-invoice',
	validateRoleRequest([
		'CFO', 'LIABILITIES_ACCOUNTANT',
		'PURCHASING', 'PM',
	]),
	async ( req, res, next ) => {
		try {
			const result = await req.Uploader.upload( req, res, 'invoices', false );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.post(
	'/upload-payment-order',
	validateRoleRequest( [ 'CFO', 'LIABILITIES_ACCOUNTANT' ] ),
	async ( req, res, next ) => {
		try {
			const result = await req.Uploader.upload( req, res, 'payment-orders', false );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.post(
	'/upload-procedure',
	validateRoleRequest( [ 'PURCHASING', 'PM' ] ),
	async ( req, res, next ) => {
		try {
			const result = await req.Uploader.upload( req, res, 'procedures', false );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.delete( '/delete/:id', validateRoleRequest( [ 'CEO', 'SALE' ] ), async ( req, res, next ) => {
	try {
		const result = await req.ProjectHandler.handleSoftDelete( +req.params.id );

		// Destroy cache
		ApiCache.destroy( res );

		res.status( STATUS_CODE.OK );
		res.json( result );
	} catch ( error ) {
		next( error );
	}
} );

router.get(
	'/export/:id',
	ApiCache.cache( CONSTANTS.API_CACHE_EXPIRE ),
	validateRoleRequest( [
		'CEO', 'CFO', 'GENERAL_ACCOUNTANT',
		'LIABILITIES_ACCOUNTANT', 'PROCUREMENT_MANAGER', 'CONSTRUCTION_MANAGER',
		'PM', 'SALE',
		'QS', 'PURCHASING',
	] ),
	async ( req, res, next ) => {
		try {
			const result = await req.ProjectExportHandler.handleExport( +req.params.id );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

router.put(
	'/change-user/:id',
	validateRoleRequest( [ 'CEO' ] ),
	async ( req, res, next ) => {
		try {
			req.checkBody( 'manage_by' ).notEmpty();
			req.checkBody( 'sale_by' ).notEmpty();
			req.checkBody( 'qs_by' ).notEmpty();
			req.checkBody( 'purchase_by' ).notEmpty();

			// Validate body
			await Validator.validate( req );
			const result = await req.ProjectUserHandler.handleChange( +req.params.id, req.body );

			// Destroy cache
			ApiCache.destroy( res );

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

module.exports = router;
