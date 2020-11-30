const Q = require( 'q' );
const Sequelize = require( 'sequelize' );

const VendorCategoryRepository = require( '@models/finance/vendor/vendor_category_repository' );

const { Logger } = require( '@helpers' );

const Op = Sequelize.Op;

class VendorCategoryHandler {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		this.channelId = channelId;
	}

	/**
	* Handle get vendor categories
	* @param {object} queryOptions
	* @return {promise}
	*/
	handleGetAll( queryOptions = {} ) {
		const vendorCategoryRepository = new VendorCategoryRepository( this.channelId );

		if ( queryOptions && queryOptions.query_for === 'reference' ) {
			return vendorCategoryRepository.getAll({
				attributes: [ 'id', 'name' ],
			});
		}

		return vendorCategoryRepository.getAll();
	}

	/**
	* Handle create vendor category
	* @param {object} data - Vendor category data
	* @return {promise}
	*/
	async handleCreate( data ) {
		const deferred = Q.defer();

		try {
			// Create vendor category
			const createData = {
				name		: data.name,
				description	: data.description,
			};

			const [ vendorCategory, created ] = await new VendorCategoryRepository( this.channelId )
			.findOrCreate({
				defaults: createData,
				where: { name: createData.name },
			});

			if ( !vendorCategory || !vendorCategory.id || !created ) {
				deferred.resolve({
					status	: false,
					message	: 'VENDOR_CATEGORY_ALREADY_EXISTS',
				});
				return deferred.promise;
			}

			deferred.resolve({
				status	: true,
				message	: 'CREATE_VENDOR_CATEGORY_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update vendor category
	* @param {int} id - Vendor category id
	* @param {object} data - Vendor category data
	* @return {promise}
	*/
	async handleUpdate( id, data ) {
		const deferred = Q.defer();

		try {
			const vendorCategoryRepository = await new VendorCategoryRepository( this.channelId );
			const vendorCategory = await vendorCategoryRepository.getOne({
				where: {
					id	: { [ Op.ne ]: id },
					name: data.name,
				},
			});

			if ( vendorCategory ) {
				deferred.resolve({
					status	: false,
					message	: 'VENDOR_CATEGORY_ALREADY_EXISTS',
				});
				return deferred.promise;
			}

			// Update vendor category
			const updateData = {
				name		: data.name,
				description	: data.description,
			};
			const updateOptions = {
				where: { id },
			};

			return vendorCategoryRepository.update( updateData, updateOptions );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle delete vendor category
	* @param {int} id - Vendor category id
	* @return {promise}
	*/
	handleDelete( id ) {
		const deleteOptions = {
			where: { id },
		};

		return new VendorCategoryRepository( this.channelId ).delete( deleteOptions );
	}

}

module.exports = VendorCategoryHandler;
