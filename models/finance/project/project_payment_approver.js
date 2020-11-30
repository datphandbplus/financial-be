const Sequelize = require( 'sequelize' );
const Q = require( 'q' );
const _ = require( 'underscore' );

const BaseModel = require( '@models/base' );
const User = require( '@models/finance/user/user' );
const UserRole = require( '@models/finance/user/user_role' );
const ProjectPayment = require( './project_payment' );

const { CONSTANTS } = require( '@resources' );

module.exports = async channelId => {
	const deferred = Q.defer();

	try {
		let ProjectPaymentApproverModel = BaseModel.get( channelId, 'project_payment_approver' );

		if ( ProjectPaymentApproverModel ) {
			deferred.resolve( ProjectPaymentApproverModel );
			return deferred.promise;
		}

		const ProjectPaymentModel = await ProjectPayment( channelId );
		const UserModel = await User( channelId );
		const UserRoleModel = await UserRole( channelId );

		ProjectPaymentApproverModel = await BaseModel.define(
			channelId,
			'project_payment_approver',
			{
				project_payment_id: {
					type		: Sequelize.INTEGER,
					onUpdate	: 'CASCADE',
					onDelete	: 'CASCADE',
					allowNull	: false,
					references: {
						model	: ProjectPaymentModel,
						key		: 'id',
					},
				},
				user_id: {
					type	: Sequelize.INTEGER,
					onUpdate: 'CASCADE',
					onDelete: 'SET NULL',
					references: {
						model	: UserModel,
						key		: 'id',
					},
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
				status: {
					type		: Sequelize.INTEGER.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { isIn: [ _.values( CONSTANTS.PAYMENT_APPROVE_STATUS ) ] },
				},
				approved_at	: Sequelize.DATE,
				comment		: Sequelize.TEXT( 'long' ),
			}
		);

		try {
			ProjectPaymentModel.hasMany( ProjectPaymentApproverModel, { foreignKey: 'project_payment_id' } );
			ProjectPaymentApproverModel.belongsTo( ProjectPaymentModel, { foreignKey: 'project_payment_id' } );

			UserModel.hasMany( ProjectPaymentApproverModel, { foreignKey: 'user_id' } );
			ProjectPaymentApproverModel.belongsTo( UserModel, { foreignKey: 'user_id' } );

			UserRoleModel.hasMany( ProjectPaymentApproverModel, { foreignKey: 'role_key' } );
			ProjectPaymentApproverModel.belongsTo( UserRoleModel, { foreignKey: 'role_key' } );
		} catch {}

		// Cache model is associated
		BaseModel.set( channelId, 'project_payment_approver', ProjectPaymentApproverModel );

		deferred.resolve( ProjectPaymentApproverModel );
	} catch ( error ) {
		deferred.reject( error );
	}

	return deferred.promise;
};
