const Sequelize = require( 'sequelize' );
const Q = require( 'q' );

const BaseModel = require( '@models/base' );

module.exports = async channelId => {
	const deferred = Q.defer();

	try {
		let LezoProjectModel = BaseModel.get( channelId, 'lezo_project' );

		if ( LezoProjectModel ) {
			deferred.resolve( LezoProjectModel );
			return deferred.promise;
		}

		LezoProjectModel = await BaseModel.define(
			channelId,
			'lezo_project',
			{
				client_id	: Sequelize.INTEGER,
				name		: Sequelize.STRING,
			},
			{
				ext_app		: 'lezo',
				tableName	: 'kpi_projects',
			}
		);

		// Cache model is associated
		BaseModel.set( channelId, 'lezo_project', LezoProjectModel );

		deferred.resolve( LezoProjectModel );
	} catch ( error ) {
		deferred.reject( error );
	}

	return deferred.promise;
};
