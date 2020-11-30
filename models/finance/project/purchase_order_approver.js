const Sequelize = require( 'sequelize' );
const Q = require( 'q' );
const _ = require( 'underscore' );

const BaseModel = require( '@models/base' );
const User = require( '@models/finance/user/user' );
const UserRole = require( '@models/finance/user/user_role' );
const ProjectPurchaseOrder = require( './project_purchase_order' );

const { CONSTANTS } = require( '@resources' );

module.exports = async channelId => {
	const deferred = Q.defer();

	try {
		let PurchaseOrderApproverModel = BaseModel.get( channelId, 'project_po_approver' );

		if ( PurchaseOrderApproverModel ) {
			deferred.resolve( PurchaseOrderApproverModel );
			return deferred.promise;
		}

		const ProjectPurchaseOrderModel = await ProjectPurchaseOrder( channelId );
		const UserModel = await User( channelId );
		const UserRoleModel = await UserRole( channelId );

		PurchaseOrderApproverModel = await BaseModel.define(
			channelId,
			'project_po_approver',
			{
				project_purchase_order_id: {
					type		: Sequelize.INTEGER,
					onUpdate	: 'CASCADE',
					onDelete	: 'CASCADE',
					allowNull	: false,
					references: {
						model	: ProjectPurchaseOrderModel,
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
					validate	: { isIn: [ _.values( CONSTANTS.QUOTATION_STATUS ) ] },
				},
				approved_at	: Sequelize.DATE,
				comment		: Sequelize.TEXT( 'long' ),
			}
		);

		try {
			ProjectPurchaseOrderModel.hasMany( PurchaseOrderApproverModel, { foreignKey: 'project_purchase_order_id' } );
			PurchaseOrderApproverModel.belongsTo( ProjectPurchaseOrderModel, { foreignKey: 'project_purchase_order_id' } );

			UserModel.hasMany( PurchaseOrderApproverModel, { foreignKey: 'user_id' } );
			PurchaseOrderApproverModel.belongsTo( UserModel, { foreignKey: 'user_id' } );

			UserRoleModel.hasMany( PurchaseOrderApproverModel, { foreignKey: 'role_key' } );
			PurchaseOrderApproverModel.belongsTo( UserRoleModel, { foreignKey: 'role_key' } );
		} catch {}

		// Cache model is associated
		BaseModel.set( channelId, 'project_po_approver', PurchaseOrderApproverModel );

		deferred.resolve( PurchaseOrderApproverModel );
	} catch ( error ) {
		deferred.reject( error );
	}

	return deferred.promise;
};
