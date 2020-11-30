const Sequelize = require( 'sequelize' );
const Q = require( 'q' );

const BaseModel = require( '@models/base' );

module.exports = async channelId => {
	const deferred = Q.defer();

	try {
		let VendorCategoryModel = BaseModel.get( channelId, 'vendor_category' );

		if ( VendorCategoryModel ) {
			deferred.resolve( VendorCategoryModel );
			return deferred.promise;
		}

		VendorCategoryModel = await BaseModel.define(
			channelId,
			'vendor_category',
			{
				name: {
					type		: Sequelize.STRING,
					allowNull	: false,
					validate	: { len: [ 1, 255 ] },
				},
				description: Sequelize.TEXT( 'long' ),
			},
			{
				tableName: 'vendor_categories',
				indexes: [
					{
						unique: true,
						fields: [ 'name' ],
					},
				],
			}
		);

		// Cache model is associated
		BaseModel.set( channelId, 'vendor_category', VendorCategoryModel );

		deferred.resolve( VendorCategoryModel );
	} catch ( error ) {
		deferred.reject( error );
	}

	return deferred.promise;
};
