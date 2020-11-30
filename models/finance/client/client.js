const Sequelize = require( 'sequelize' );
const Q = require( 'q' );

const BaseModel = require( '@models/base' );
const LezoClient = require( '@models/ext/lezo/lezo_client' );

module.exports = async channelId => {
	const deferred = Q.defer();

	try {
		let ClientModel = BaseModel.get( channelId, 'client' );

		if ( ClientModel ) {
			deferred.resolve( ClientModel );
			return deferred.promise;
		}

		const LezoClientModel = await LezoClient( channelId );

		ClientModel = await BaseModel.define(
			channelId,
			'client',
			{
				lezo_client_id: {
					type: Sequelize.INTEGER,
					...(
						LezoClientModel && {
							onUpdate: 'CASCADE',
							onDelete: 'SET NULL',
							references: {
								model: {
									schema		: LezoClientModel._schema,
									tableName	: LezoClientModel.tableName,
									name		: LezoClientModel.name,
								},
								key: 'id',
							},
						}
					),
				},
				name: {
					type		: Sequelize.STRING,
					allowNull	: false,
					validate	: { len: [ 1, 255 ] },
				},
				short_name: {
					type		: Sequelize.STRING,
					allowNull	: false,
					validate	: { len: [ 1, 255 ] },
				},
				phone: {
					type		: Sequelize.STRING,
					allowNull	: false,
					validate	: { len: [ 0, 255 ] },
				},
				tax: {
					type	: Sequelize.STRING,
					validate: { len: [ 0, 255 ] },
				},
				address: {
					type	: Sequelize.STRING,
					validate: { len: [ 0, 255 ] },
				},
				bank_name: {
					type	: Sequelize.STRING,
					validate: { len: [ 0, 255 ] },
				},
				bank_province: {
					type	: Sequelize.STRING,
					validate: { len: [ 0, 255 ] },
				},
				bank_branch: {
					type	: Sequelize.STRING,
					validate: { len: [ 0, 255 ] },
				},
				bank_account_number: {
					type	: Sequelize.STRING,
					validate: { len: [ 0, 255 ] },
				},
				payment_term: {
					type		: Sequelize.INTEGER.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { min: 0 },
				},
				is_disabled: {
					type		: Sequelize.BOOLEAN,
					allowNull	: false,
					defaultValue: false,
				},
				description	: Sequelize.TEXT( 'long' ),
				contact_list: Sequelize.TEXT( 'long' ),
			},
			{
				paranoid: true,
				setterMethods: {
					contact_list( value ) {
						this.setDataValue( 'contact_list', JSON.stringify( value ) );
					},
				},
				getterMethods: {
					contact_list() {
						const contactList = this.getDataValue( 'contact_list' );
						return contactList ? JSON.parse( contactList ) : undefined;
					},
				},
			}
		);

		try {
			if ( LezoClientModel ) {
				LezoClientModel.hasOne( ClientModel, { foreignKey: 'lezo_client_id' } );
				ClientModel.belongsTo( LezoClientModel, { foreignKey: 'lezo_client_id' } );
			}
		} catch {}

		// Cache model is associated
		BaseModel.set( channelId, 'client', ClientModel );

		deferred.resolve( ClientModel );
	} catch ( error ) {
		deferred.reject( error );
	}

	return deferred.promise;
};
