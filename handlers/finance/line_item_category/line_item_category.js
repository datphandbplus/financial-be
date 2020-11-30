const Q = require( 'q' );
const Sequelize = require( 'sequelize' );

const LineItemCategoryRepository = require( '@models/finance/line_item_category/line_item_category_repository' );

const { Logger } = require( '@helpers' );

const Op = Sequelize.Op;

class LineItemCategoryHandler {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		this.channelId = channelId;
	}

	/**
	* Handle get line item categories
	* @param {object} queryOptions
	* @return {promise}
	*/
	handleGetAll( queryOptions = {} ) {
		const lineItemCategoryRepository = new LineItemCategoryRepository( this.channelId );

		if ( queryOptions && queryOptions.query_for === 'reference' ) {
			return lineItemCategoryRepository.getAll({
				attributes: [ 'id', 'name' ],
			});
		}

		return lineItemCategoryRepository.getAll();
	}

	/**
	* Handle create line item category
	* @param {object} data - Line item category data
	* @return {promise}
	*/
	async handleCreate( data ) {
		const deferred = Q.defer();

		try {
			// Create line item category
			const createData = {
				name		: data.name,
				description	: data.description,
			};

			const [ lineItemCategory, created ] = await new LineItemCategoryRepository( this.channelId )
			.findOrCreate({
				defaults: createData,
				where: { name: createData.name },
			});

			if ( !lineItemCategory || !lineItemCategory.id || !created ) {
				deferred.resolve({
					status	: false,
					message	: 'LINE_ITEM_CATEGORY_ALREADY_EXISTS',
				});
				return deferred.promise;
			}

			deferred.resolve({
				status	: true,
				message	: 'CREATE_LINE_ITEM_CATEGORY_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update line item category
	* @param {int} id - Line item category id
	* @param {object} data - Line item category data
	* @return {promise}
	*/
	async handleUpdate( id, data ) {
		const deferred = Q.defer();

		try {
			const lineItemCategoryRepository = await new LineItemCategoryRepository( this.channelId );
			const lineItemCategory = await lineItemCategoryRepository.getOne({
				where: {
					id	: { [ Op.ne ]: id },
					name: data.name,
				},
			});

			if ( lineItemCategory ) {
				deferred.resolve({
					status	: false,
					message	: 'LINE_ITEM_CATEGORY_ALREADY_EXISTS',
				});
				return deferred.promise;
			}

			// Update line item category
			const updateData = {
				name		: data.name,
				description	: data.description,
			};
			const updateOptions = {
				where: { id },
			};

			return lineItemCategoryRepository.update( updateData, updateOptions );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle delete line item category
	* @param {int} id - Line item category id
	* @return {promise}
	*/
	handleDelete( id ) {
		const deleteOptions = {
			where: { id },
		};

		return new LineItemCategoryRepository( this.channelId ).delete( deleteOptions );
	}

}

module.exports = LineItemCategoryHandler;
