const Sequelize = require( 'sequelize' );
const Q = require( 'q' );

const BaseModel = require( '@models/base' );

module.exports = async channelId => {
	const deferred = Q.defer();

	try {
		let CostItemCategoryModel = BaseModel.get( channelId, 'cost_item_category' );

		if ( CostItemCategoryModel ) {
			deferred.resolve( CostItemCategoryModel );
			return deferred.promise;
		}

		CostItemCategoryModel = await BaseModel.define(
			channelId,
			'cost_item_category',
			{
				name: {
					type		: Sequelize.STRING,
					allowNull	: false,
					validate	: { len: [ 1, 255 ] },
				},
				description: Sequelize.TEXT( 'long' ),
			},
			{
				tableName: 'cost_item_categories',
				indexes: [
					{
						unique: true,
						fields: [ 'name' ],
					},
				],
			}
		);

		// Cache model is associated
		BaseModel.set( channelId, 'cost_item_category', CostItemCategoryModel );

		deferred.resolve( CostItemCategoryModel );
	} catch ( error ) {
		deferred.reject( error );
	}

	return deferred.promise;
};
