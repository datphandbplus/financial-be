const Sequelize = require( 'sequelize' );
const Q = require( 'q' );

const BaseModel = require( '@models/base' );
const UserRoleDump = require( './user_role_dump' );

module.exports = async channelId => {
	const deferred = Q.defer();

	try {
		let UserRole = BaseModel.get( channelId, 'user_role' );

		if ( UserRole ) {
			deferred.resolve( UserRole );
			return deferred.promise;
		}

		UserRole = await BaseModel.define(
			channelId,
			'user_role',
			{
				key: {
					type		: Sequelize.STRING,
					allowNull	: false,
					validate	: { len: [ 1, 255 ] },
					primaryKey	: true,
				},
				name: {
					type		: Sequelize.STRING,
					allowNull	: false,
					validate	: { len: [ 1, 255 ] },
				},
			},
			{ dump: UserRoleDump }
		);

		// Cache model is associated
		BaseModel.set( channelId, 'user_role', UserRole );

		deferred.resolve( UserRole );
	} catch ( error ) {
		deferred.reject( error );
	}

	return deferred.promise;
};
