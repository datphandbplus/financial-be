const Sequelize = require( 'sequelize' );
const Q = require( 'q' );

const BaseModel = require( '@models/base' );

module.exports = async channelId => {
	const deferred = Q.defer();

	try {
		let LineItemCategoryModel = BaseModel.get( channelId, 'line_item_category' );

		if ( LineItemCategoryModel ) {
			deferred.resolve( LineItemCategoryModel );
			return deferred.promise;
		}

		LineItemCategoryModel = await BaseModel.define(
			channelId,
			'line_item_category',
			{
				name: {
					type		: Sequelize.STRING,
					allowNull	: false,
					validate	: { len: [ 1, 255 ] },
				},
				description: Sequelize.TEXT( 'long' ),
			},
			{
				tableName: 'line_item_categories',
				indexes: [
					{
						unique: true,
						fields: [ 'name' ],
					},
				],
			}
		);

		// Cache model is associated
		BaseModel.set( channelId, 'line_item_category', LineItemCategoryModel );

		deferred.resolve( LineItemCategoryModel );
	} catch ( error ) {
		deferred.reject( error );
	}

	return deferred.promise;
};
