const Sequelize = require( 'sequelize' );
const Q = require( 'q' );

const BaseModel = require( '@models/base' );

module.exports = async channelId => {
	const deferred = Q.defer();

	try {
		let LezoClientModel = BaseModel.get( channelId, 'lezo_client' );

		if ( LezoClientModel ) {
			deferred.resolve( LezoClientModel );
			return deferred.promise;
		}

		LezoClientModel = await BaseModel.define(
			channelId,
			'lezo_client',
			{
				name		: Sequelize.STRING,
				description	: Sequelize.TEXT( 'long' ),
			},
			{
				ext_app		: 'lezo',
				tableName	: 'kpi_clients',
			}
		);

		// Cache model is associated
		BaseModel.set( channelId, 'lezo_client', LezoClientModel );

		deferred.resolve( LezoClientModel );
	} catch ( error ) {
		deferred.reject( error );
	}

	return deferred.promise;
};
