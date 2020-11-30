const Sequelize = require( 'sequelize' );
const Q = require( 'q' );

const BaseModel = require( '@models/base' );
const SettingDump = require( './setting_dump' );

module.exports = async channelId => {
	const deferred = Q.defer();

	try {
		let SettingModel = BaseModel.get( channelId, 'setting' );

		if ( SettingModel ) {
			deferred.resolve( SettingModel );
			return deferred.promise;
		}

		SettingModel = await BaseModel.define(
			channelId,
			'setting',
			{
				key: {
					type		: Sequelize.STRING,
					allowNull	: false,
					validate	: { len: [ 1, 255 ] },
					primaryKey	: true,
				},
				value: Sequelize.TEXT( 'long' ),
			},
			{ dump: SettingDump }
		);

		// Cache model is associated
		BaseModel.set( channelId, 'setting', SettingModel );

		deferred.resolve( SettingModel );
	} catch ( error ) {
		deferred.reject( error );
	}

	return deferred.promise;
};
