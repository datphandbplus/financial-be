const Q = require( 'q' );
const Sequelize = require( 'sequelize' );

const CostItemCategoryRepository = require( '@models/finance/cost_item_category/cost_item_category_repository' );

const { Logger } = require( '@helpers' );

const Op = Sequelize.Op;

class CostItemCategoryHandler {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		this.channelId = channelId;
	}

	/**
	* Handle get cost item categories
	* @param {object} queryOptions
	* @return {promise}
	*/
	handleGetAll( queryOptions = {} ) {
		const costItemCategoryRepository = new CostItemCategoryRepository( this.channelId );

		if ( queryOptions && queryOptions.query_for === 'reference' ) {
			return costItemCategoryRepository.getAll({
				attributes: [ 'id', 'name' ],
			});
		}

		return costItemCategoryRepository.getAll();
	}

	/**
	* Handle create cost item category
	* @param {object} data - Cost item category data
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

			const [ costItemCategory, created ] = await new CostItemCategoryRepository( this.channelId )
			.findOrCreate({
				defaults: createData,
				where	: { name: createData.name },
			});

			if ( !costItemCategory || !created ) {
				deferred.resolve({
					status	: false,
					message	: 'COST_ITEM_CATEGORY_ALREADY_EXISTS',
				});
				return deferred.promise;
			}

			deferred.resolve({
				status	: true,
				message	: 'CREATE_COST_ITEM_CATEGORY_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update cost item category
	* @param {int} id - Cost item category id
	* @param {object} data - Cost item category data
	* @return {promise}
	*/
	async handleUpdate( id, data ) {
		const deferred = Q.defer();

		try {
			const costItemCategoryRepository = await new CostItemCategoryRepository( this.channelId );
			const costItemCategory = await costItemCategoryRepository.getOne({
				where: {
					id	: { [ Op.ne ]: id },
					name: data.name,
				},
			});

			if ( costItemCategory ) {
				deferred.resolve({
					status	: false,
					message	: 'COST_ITEM_CATEGORY_ALREADY_EXISTS',
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

			return costItemCategoryRepository.update( updateData, updateOptions );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle delete cost item category
	* @param {int} id - Cost item category id
	* @return {promise}
	*/
	handleDelete( id ) {
		const deleteOptions = {
			where: { id },
		};

		return new CostItemCategoryRepository( this.channelId ).delete( deleteOptions );
	}

}

module.exports = CostItemCategoryHandler;
