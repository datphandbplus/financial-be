const Sequelize = require( 'sequelize' );
const Q = require( 'q' );

const BaseModel = require( '@models/base' );

module.exports = async channelId => {
	const deferred = Q.defer();

	try {
		let LezoEmployeeModel = BaseModel.get( channelId, 'lezo_employee' );

		if ( LezoEmployeeModel ) {
			deferred.resolve( LezoEmployeeModel );
			return deferred.promise;
		}

		LezoEmployeeModel = await BaseModel.define(
			channelId,
			'lezo_employee',
			{
				email		: Sequelize.STRING,
				full_name	: Sequelize.STRING,
				avatar		: Sequelize.TEXT( 'long' ),
				status		: Sequelize.INTEGER,
			},
			{
				ext_app		: 'lezo',
				tableName	: 'hr_employees',
			}
		);

		// Cache model is associated
		BaseModel.set( channelId, 'lezo_employee', LezoEmployeeModel );

		deferred.resolve( LezoEmployeeModel );
	} catch ( error ) {
		deferred.reject( error );
	}

	return deferred.promise;
};
