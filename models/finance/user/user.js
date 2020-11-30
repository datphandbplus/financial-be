const Sequelize = require( 'sequelize' );
const Q = require( 'q' );

const BaseModel = require( '@models/base' );
const UserRole = require( './user_role' );
const LezoEmployee = require( '@models/ext/lezo/lezo_employee' );
const WebURL = require( '@helpers/web_url' );

module.exports = async channelId => {
	const deferred = Q.defer();

	try {
		let UserModel = BaseModel.get( channelId, 'user' );

		if ( UserModel ) {
			deferred.resolve( UserModel );
			return deferred.promise;
		}

		const UserRoleModel = await UserRole( channelId );
		const LezoEmployeeModel = await LezoEmployee( channelId );

		UserModel = await BaseModel.define(
			channelId,
			'user',
			{
				lezo_employee_id: {
					type: Sequelize.INTEGER,
					...(
						LezoEmployeeModel && {
							onUpdate: 'CASCADE',
							onDelete: 'SET NULL',
							references: {
								model: {
									schema		: LezoEmployeeModel._schema,
									tableName	: LezoEmployeeModel.tableName,
									name		: LezoEmployeeModel.name,
								},
								key: 'id',
							},
						}
					),
				},
				role_key: {
					type	: Sequelize.STRING,
					onUpdate: 'CASCADE',
					onDelete: 'SET NULL',
					references: {
						model	: UserRoleModel,
						key		: 'key',
					},
				},
				email: {
					type		: Sequelize.STRING,
					allowNull	: false,
					validate: {
						isEmail	: true,
						len		: [ 1, 255 ],
					},
				},
				full_name: {
					type		: Sequelize.STRING,
					allowNull	: false,
					validate	: { len: [ 1, 255 ] },
				},
				is_owner: {
					type		: Sequelize.BOOLEAN,
					allowNull	: false,
					defaultValue: false,
				},
				is_disabled: {
					type		: Sequelize.BOOLEAN,
					allowNull	: false,
					defaultValue: true,
				},
				avatar: Sequelize.TEXT( 'long' ),
			},
			{
				indexes: [
					{
						unique: true,
						fields: [ 'email' ],
					},
				],
				getterMethods: {
					avatar() {
						const avatar = this.getDataValue( 'avatar' );
						return avatar ? WebURL.convertPathToURL( avatar ) : undefined;
					},
				},
			}
		);

		try {
			if ( LezoEmployeeModel ) {
				LezoEmployeeModel.hasOne( UserModel, { foreignKey: 'lezo_employee_id' } );
				UserModel.belongsTo( LezoEmployeeModel, { foreignKey: 'lezo_employee_id' } );
			}

			UserRoleModel.hasMany( UserModel, { foreignKey: 'role_key' } );
			UserModel.belongsTo( UserRoleModel, { foreignKey: 'role_key' } );
		} catch {}

		// Cache model is associated
		BaseModel.set( channelId, 'user', UserModel );

		deferred.resolve( UserModel );
	} catch ( error ) {
		deferred.reject( error );
	}

	return deferred.promise;
};
