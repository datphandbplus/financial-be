const Q = require( 'q' );
const Sequelize = require( 'sequelize' );

const VendorRepository = require( '@models/finance/vendor/vendor_repository' );
const VendorCategory = require( '@models/finance/vendor/vendor_category' );

const { Logger, Account } = require( '@helpers' );
const { STATUS_CODE, STATUS_MESSAGE } = require( '@resources' );

const Op = Sequelize.Op;

class VendorHandler {

	/**
	* @constructor
	* @param {string} channelId
	* @param {object} userData
	*/
	constructor( channelId, userData = null ) {
		this.channelId = channelId;
		this.currentUser = userData;
		this.account = new Account( userData );
	}

	/**
	* Handle get vendors
	* @param {object} queryOptions
	* @return {promise}
	*/
	async handleGetAll( queryOptions = {} ) {
		const deferred = Q.defer();

		try {
			const vendorRepository = new VendorRepository( this.channelId );

			if ( queryOptions && queryOptions.query_for === 'reference' ) {
				return vendorRepository
				.getAll({
					attributes	: [ 'id', 'short_name' ],
					where		: { is_disabled: false },
				});
			}

			if ( queryOptions && queryOptions.query_for === 'category' ) {
				return vendorRepository
				.getAll({
					attributes	: [ 'id', 'short_name' ],
					where		: {
						is_disabled			: false,
						vendor_category_id	: queryOptions.query_category_id || null,
					},
				});
			}

			// In case user is not CEO/Admin/Procurement Manager
			if ( !this.account.isCEO()
				&& !this.account.isAdmin()
				&& !this.account.isProcurementManager()
				&& !this.account.isConstructionManager() ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			return vendorRepository.getAll({
				attributes: [
					'id', 'vendor_category_id', 'name',
					'short_name', 'phone', 'tax',
					'address', 'bank_name', 'bank_province',
					'bank_branch', 'bank_account_number', 'payment_term',
					'description', 'is_disabled', 'contact_list',
				],
				include: {
					model		: await VendorCategory( this.channelId ),
					attributes	: [ 'id', 'name' ],
				},
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle create vendor
	* @param {object} data - Vendor data
	* @return {promise}
	*/
	async handleCreate( data ) {
		const deferred = Q.defer();

		try {
			// Create vendor
			const createData = {
				vendor_category_id	: data.vendor_category_id || null,
				name				: data.name,
				short_name			: data.short_name,
				phone				: data.phone,
				tax					: data.tax,
				address				: data.address,
				bank_name			: data.bank_name,
				bank_province		: data.bank_province,
				bank_branch			: data.bank_branch,
				bank_account_number	: data.bank_account_number,
				payment_term		: +data.payment_term,
				description			: data.description,
				contact_list		: data.contact_list,
			};

			const [ vendor, created ] = await new VendorRepository( this.channelId )
			.findOrCreate({
				defaults: createData,
				where	: { name: createData.name },
			});

			if ( !vendor || !created ) {
				deferred.resolve({
					status	: false,
					message	: 'VENDOR_ALREADY_EXISTS',
				});
				return deferred.promise;
			}

			deferred.resolve({
				status	: true,
				message	: 'CREATE_VENDOR_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update vendor
	* @param {int} id - Vendor id
	* @param {object} data - Vendor data
	* @return {promise}
	*/
	async handleUpdate( id, data ) {
		const deferred = Q.defer();

		try {
			const vendorRepository = await new VendorRepository( this.channelId );
			const vendor = await vendorRepository.getOne({
				where: {
					id	: { [ Op.ne ]: id },
					name: data.name,
				},
			});

			if ( vendor ) {
				deferred.resolve({
					status	: false,
					message	: 'VENDOR_ALREADY_EXISTS',
				});
				return deferred.promise;
			}

			// Update vendor
			const updateData = {
				vendor_category_id	: data.vendor_category_id || null,
				name				: data.name,
				short_name			: data.short_name,
				phone				: data.phone,
				tax					: data.tax,
				address				: data.address,
				bank_name			: data.bank_name,
				bank_province		: data.bank_province,
				bank_branch			: data.bank_branch,
				bank_account_number	: data.bank_account_number,
				payment_term		: +data.payment_term,
				description			: data.description,
				is_disabled			: data.is_disabled,
				contact_list		: data.contact_list,
			};
			const updateOptions = {
				where: { id },
			};

			return vendorRepository.update( updateData, updateOptions );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle soft delete vendor
	* @param {int} id - Vendor id
	* @return {promise}
	*/
	handleSoftDelete( id ) {
		return new VendorRepository( this.channelId ).delete( { where: { id } } );
	}

}

module.exports = VendorHandler;
