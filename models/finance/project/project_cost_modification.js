const Sequelize = require( 'sequelize' );
const Q = require( 'q' );

const BaseModel = require( '@models/base' );
const User = require( '@models/finance/user/user' );
const Project = require( './project' );
const ProjectCostItem = require( './project_cost_item' );
const Vendor = require( '@models/finance/vendor/vendor' );

module.exports = async channelId => {
	const deferred = Q.defer();

	try {
		let ProjectCostModificationModel = BaseModel.get( channelId, 'project_cost_modification' );

		if ( ProjectCostModificationModel ) {
			deferred.resolve( ProjectCostModificationModel );
			return deferred.promise;
		}

		const UserModel = await User( channelId );
		const ProjectModel = await Project( channelId );
		const ProjectCostItemModel = await ProjectCostItem( channelId );
		const VendorModel = await Vendor( channelId );

		ProjectCostModificationModel = await BaseModel.define(
			channelId,
			'project_cost_modification',
			{
				project_id: {
					type		: Sequelize.INTEGER,
					onUpdate	: 'CASCADE',
					onDelete	: 'CASCADE',
					allowNull	: false,
					references: {
						model	: ProjectModel,
						key		: 'id',
					},
				},
				project_cost_item_id: {
					type		: Sequelize.INTEGER,
					onUpdate	: 'CASCADE',
					onDelete	: 'SET NULL',
					references: {
						model	: ProjectCostItemModel,
						key		: 'id',
					},
				},
				vendor_id: {
					type	: Sequelize.INTEGER,
					onUpdate: 'CASCADE',
					onDelete: 'SET NULL',
					references: {
						model	: VendorModel,
						key		: 'id',
					},
				},
				approve_by: {
					type	: Sequelize.INTEGER,
					onUpdate: 'CASCADE',
					onDelete: 'SET NULL',
					references: {
						model	: UserModel,
						key		: 'id',
					},
				},
				name: {
					type		: Sequelize.STRING,
					allowNull	: false,
					validate	: { len: [ 1, 255 ] },
				},
				unit: {
					type		: Sequelize.STRING,
					allowNull	: false,
					validate	: { len: [ 1, 255 ] },
				},
				old_amount: {
					type		: Sequelize.DOUBLE.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { min: 0 },
				},
				old_price: {
					type		: Sequelize.DOUBLE.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { min: 0 },
				},
				new_amount: {
					type		: Sequelize.DOUBLE.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { min: 0 },
				},
				new_price: {
					type		: Sequelize.DOUBLE.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { min: 0 },
				},
				status: {
					type		: Sequelize.INTEGER.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { min: 0 },
				},
			}
		);

		try {
			UserModel.hasMany( ProjectCostModificationModel, { foreignKey: 'approve_by' } );
			ProjectCostModificationModel.belongsTo( UserModel, { foreignKey: 'approve_by' } );

			ProjectModel.hasMany( ProjectCostModificationModel, { foreignKey: 'project_id' } );
			ProjectCostModificationModel.belongsTo( ProjectModel, { foreignKey: 'project_id' } );

			ProjectCostItemModel.hasMany( ProjectCostModificationModel, { foreignKey: 'project_cost_item_id' } );
			ProjectCostModificationModel.belongsTo( ProjectCostItemModel, { foreignKey: 'project_cost_item_id' } );

			VendorModel.hasMany( ProjectCostModificationModel, { foreignKey: 'vendor_id' } );
			ProjectCostModificationModel.belongsTo( VendorModel, { foreignKey: 'vendor_id' } );
		} catch {}

		// Cache model is associated
		BaseModel.set( channelId, 'project_cost_modification', ProjectCostModificationModel );

		deferred.resolve( ProjectCostModificationModel );
	} catch ( error ) {
		deferred.reject( error );
	}

	return deferred.promise;
};
