const Sequelize = require( 'sequelize' );
const Q = require( 'q' );
const _ = require( 'underscore' );

const BaseModel = require( '@models/base' );
const User = require( '@models/finance/user/user' );
const Client = require( '@models/finance/client/client' );
const LezoProject = require( '@models/ext/lezo/lezo_project' );

const { CONSTANTS } = require( '@resources' );

module.exports = async channelId => {
	const deferred = Q.defer();

	try {
		let ProjectModel = BaseModel.get( channelId, 'project' );

		if ( ProjectModel ) {
			deferred.resolve( ProjectModel );
			return deferred.promise;
		}

		const UserModel = await User( channelId );
		const ClientModel = await Client( channelId );
		const LezoProjectModel = await LezoProject( channelId );

		ProjectModel = await BaseModel.define(
			channelId,
			'project',
			{
				lezo_project_id: {
					type: Sequelize.INTEGER,
					...(
						LezoProjectModel && {
							onUpdate: 'CASCADE',
							onDelete: 'SET NULL',
							references: {
								model: {
									schema		: LezoProjectModel._schema,
									tableName	: LezoProjectModel.tableName,
									name		: LezoProjectModel.name,
								},
								key: 'id',
							},
						}
					),
				},
				manage_by: {
					type	: Sequelize.INTEGER,
					onUpdate: 'CASCADE',
					onDelete: 'SET NULL',
					references: {
						model	: UserModel,
						key		: 'id',
					},
				},
				sale_by: {
					type	: Sequelize.INTEGER,
					onUpdate: 'CASCADE',
					onDelete: 'SET NULL',
					references: {
						model	: UserModel,
						key		: 'id',
					},
				},
				qs_by: {
					type	: Sequelize.INTEGER,
					onUpdate: 'CASCADE',
					onDelete: 'SET NULL',
					references: {
						model	: UserModel,
						key		: 'id',
					},
				},
				construct_by: {
					type	: Sequelize.INTEGER,
					onUpdate: 'CASCADE',
					onDelete: 'SET NULL',
					references: {
						model	: UserModel,
						key		: 'id',
					},
				},
				purchase_by: {
					type	: Sequelize.INTEGER,
					onUpdate: 'CASCADE',
					onDelete: 'SET NULL',
					references: {
						model	: UserModel,
						key		: 'id',
					},
				},
				bill_plan_approve_by: {
					type	: Sequelize.INTEGER,
					onUpdate: 'CASCADE',
					onDelete: 'SET NULL',
					references: {
						model	: UserModel,
						key		: 'id',
					},
				},
				payment_plan_approve_by: {
					type	: Sequelize.INTEGER,
					onUpdate: 'CASCADE',
					onDelete: 'SET NULL',
					references: {
						model	: UserModel,
						key		: 'id',
					},
				},
				client_id: {
					type	: Sequelize.INTEGER,
					onUpdate: 'CASCADE',
					onDelete: 'SET NULL',
					references: {
						model	: ClientModel,
						key		: 'id',
					},
				},
				client_name: {
					type		: Sequelize.STRING,
					allowNull	: false,
					validate	: { len: [ 1, 255 ] },
				},
				client_payment_term: {
					type		: Sequelize.INTEGER.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { min: 0 },
				},
				name: {
					type		: Sequelize.STRING,
					allowNull	: false,
					validate	: { len: [ 1, 255 ] },
				},
				contact: {
					type		: Sequelize.STRING,
					allowNull	: false,
					validate	: { len: [ 1, 255 ] },
				},
				address: {
					type	: Sequelize.STRING,
					validate: { len: [ 0, 255 ] },
				},
				valid_duration: {
					type		: Sequelize.INTEGER.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { min: 0 },
				},
				project_status: {
					type		: Sequelize.INTEGER.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { isIn: [ _.values( CONSTANTS.PROJECT_STATUS ) ] },
				},
				quotation_status: {
					type		: Sequelize.INTEGER.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { isIn: [ _.values( CONSTANTS.QUOTATION_STATUS ) ] },
				},
				bill_plan_status: {
					type		: Sequelize.INTEGER.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { isIn: [ _.values( CONSTANTS.PLAN_STATUS ) ] },
				},
				payment_plan_status: {
					type		: Sequelize.INTEGER.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { isIn: [ _.values( CONSTANTS.PLAN_STATUS ) ] },
				},
				project_code: {
					type	: Sequelize.STRING,
					validate: { len: [ 0, 255 ] },
				},
				exchange_rate: {
					type		: Sequelize.INTEGER.UNSIGNED,
					allowNull	: false,
					defaultValue: 1,
					validate	: { min: 1 },
				},
				management_fee: {
					type		: Sequelize.INTEGER.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { min: 0 },
				},
				total_extra_fee: {
					type		: Sequelize.INTEGER.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { min: 0 },
				},
				extra_cost_fee: {
					type		: Sequelize.INTEGER.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { min: 0 },
				},
				max_po_price: {
					type		: Sequelize.DOUBLE.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { min: 0 },
				},
				discount_amount: {
					type		: Sequelize.DOUBLE.UNSIGNED,
					defaultValue: 0,
					validate	: { min: 0 },
				},
				discount_type: {
					type		: Sequelize.STRING,
					allowNull	: false,
					defaultValue: '$',
					validate	: { len: 1 },
				},
				quotation_date		: Sequelize.DATEONLY,
				project_start		: Sequelize.DATEONLY,
				project_end			: Sequelize.DATEONLY,
				quotation_note		: Sequelize.TEXT( 'long' ),
				bill_plan_comment	: Sequelize.TEXT( 'long' ),
				payment_plan_comment: Sequelize.TEXT( 'long' ),
			},
			{
				paranoid: true,
				randomAI: true,
				indexes: [
					{
						unique: true,
						fields: [ 'project_code' ],
					},
				],
				hooks: {
					async beforeCreate( instance, { transaction } ) {
						const attributes = instance.dataValues;
						const user = await UserModel.findOne({
							attributes	: [ 'id', 'is_disabled' ],
							where		: { id: attributes.manage_by },
							transaction,
						});

						if ( !user || user.is_disabled ) {
							throw new Error( 'USER_NOT_FOUND' );
						}

						const client = await ClientModel.findByPk( attributes.client_id, { transaction } );

						if ( !client || client.is_disabled ) {
							throw new Error( 'CLIENT_NOT_FOUND' );
						}
					},
					async beforeUpdate( instance, { transaction } ) {
						const attributes = instance.dataValues;

						if ( _.has( attributes, 'manage_by' ) ) {
							const user = await UserModel.findOne({
								attributes	: [ 'id', 'is_disabled' ],
								where		: { id: attributes.manage_by },
								transaction,
							});

							if ( !user || user.is_disabled ) {
								throw new Error( 'USER_NOT_FOUND' );
							}
						}

						if ( _.has( attributes, 'client_id' ) ) {
							const client = await ClientModel.findByPk( attributes.client_id, { transaction } );

							if ( !client || client.is_disabled ) {
								throw new Error( 'CLIENT_NOT_FOUND' );
							}
						}
					},
				},
			}
		);

		try {
			if ( LezoProjectModel ) {
				LezoProjectModel.hasOne( ProjectModel, { foreignKey: 'lezo_project_id' } );
				ProjectModel.belongsTo( LezoProjectModel, { foreignKey: 'lezo_project_id' } );
			}

			UserModel.hasMany( ProjectModel, { foreignKey: 'manage_by' } );
			ProjectModel.belongsTo( UserModel, { foreignKey: 'manage_by' } );

			UserModel.hasMany( ProjectModel, { foreignKey: 'sale_by', as: 'saler' } );
			ProjectModel.belongsTo( UserModel, { foreignKey: 'sale_by', as: 'saler' } );

			UserModel.hasMany( ProjectModel, { foreignKey: 'qs_by', as: 'qs' } );
			ProjectModel.belongsTo( UserModel, { foreignKey: 'qs_by', as: 'qs' } );

			UserModel.hasMany( ProjectModel, { foreignKey: 'construct_by', as: 'constructor' } );
			ProjectModel.belongsTo( UserModel, { foreignKey: 'construct_by', as: 'constructor' } );

			UserModel.hasMany( ProjectModel, { foreignKey: 'purchase_by', as: 'purchaser' } );
			ProjectModel.belongsTo( UserModel, { foreignKey: 'purchase_by', as: 'purchaser' } );

			UserModel.hasMany( ProjectModel, { foreignKey: 'bill_plan_approve_by', as: 'bill_plan_approver' } );
			ProjectModel.belongsTo( UserModel, { foreignKey: 'bill_plan_approve_by', as: 'bill_plan_approver' } );

			UserModel.hasMany( ProjectModel, { foreignKey: 'payment_plan_approve_by', as: 'payment_plan_approver' } );
			ProjectModel.belongsTo( UserModel, { foreignKey: 'payment_plan_approve_by', as: 'payment_plan_approver' } );

			ClientModel.hasMany( ProjectModel, { foreignKey: 'client_id' } );
			ProjectModel.belongsTo( ClientModel, { foreignKey: 'client_id' } );
		} catch {}

		// Cache model is associated
		BaseModel.set( channelId, 'project', ProjectModel );

		deferred.resolve( ProjectModel );
	} catch ( error ) {
		deferred.reject( error );
	}

	return deferred.promise;
};
