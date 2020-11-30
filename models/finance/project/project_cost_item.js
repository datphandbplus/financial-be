const Sequelize = require( 'sequelize' );
const Q = require( 'q' );
const _ = require( 'underscore' );

const BaseModel = require( '@models/base' );
const CostItemCategory = require( '@models/finance/cost_item_category/cost_item_category' );
const ProjectLineItem = require( './project_line_item' );
const ProjectPurchaseOrder = require( './project_purchase_order' );
const ProjectVO = require( './project_vo' );
const Project = require( './project' );
const Vendor = require( '@models/finance/vendor/vendor' );

const { CONSTANTS } = require( '@resources' );

module.exports = async channelId => {
	const deferred = Q.defer();

	try {
		let ProjectCostItemModel = BaseModel.get( channelId, 'project_cost_item' );

		if ( ProjectCostItemModel ) {
			deferred.resolve( ProjectCostItemModel );
			return deferred.promise;
		}

		const ProjectVOModel = await ProjectVO( channelId );
		const ProjectModel = await Project( channelId );
		const ProjectLineItemModel = await ProjectLineItem( channelId );
		const VendorModel = await Vendor( channelId );
		const ProjectPurchaseOrderModel = await ProjectPurchaseOrder( channelId );
		const CostItemCategoryModel = await CostItemCategory( channelId );

		ProjectCostItemModel = await BaseModel.define(
			channelId,
			'project_cost_item',
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
				project_line_item_id: {
					type		: Sequelize.INTEGER,
					onUpdate	: 'CASCADE',
					onDelete	: 'SET NULL',
					references: {
						model	: ProjectLineItemModel,
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
				cost_item_category_id: {
					type		: Sequelize.INTEGER,
					onUpdate	: 'CASCADE',
					onDelete	: 'SET NULL',
					references: {
						model	: CostItemCategoryModel,
						key		: 'id',
					},
				},
				project_purchase_order_id: {
					type		: Sequelize.INTEGER,
					onUpdate	: 'CASCADE',
					onDelete	: 'SET NULL',
					references: {
						model	: ProjectPurchaseOrderModel,
						key		: 'id',
					},
				},
				vo_delete_id: {
					type		: Sequelize.INTEGER,
					onUpdate	: 'CASCADE',
					onDelete	: 'SET NULL',
					references: {
						model	: ProjectVOModel,
						key		: 'id',
					},
				},
				vo_add_id: {
					type		: Sequelize.INTEGER,
					onUpdate	: 'CASCADE',
					onDelete	: 'SET NULL',
					references: {
						model	: ProjectVOModel,
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
				amount: {
					type		: Sequelize.DOUBLE.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { min: 0 },
				},
				price: {
					type		: Sequelize.DOUBLE.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { min: 0 },
				},
				bk_amount: {
					type	: Sequelize.DOUBLE.UNSIGNED,
					validate: { min: 0 },
				},
				bk_price: {
					type	: Sequelize.DOUBLE.UNSIGNED,
					validate: { min: 0 },
				},
				is_extra: {
					type		: Sequelize.BOOLEAN,
					allowNull	: false,
					defaultValue: false,
				},
				is_parent: {
					type		: Sequelize.BOOLEAN,
					allowNull	: false,
					defaultValue: false,
				},
				parent_id	: Sequelize.INTEGER,
				note		: Sequelize.TEXT( 'long' ),
				description	: Sequelize.TEXT( 'long' ),
				image		: Sequelize.TEXT( 'long' ),
			},
			{
				hooks: {
					async beforeCreate( instance, { transaction } ) {
						const attributes = instance.dataValues;
						const project = await ProjectModel.findOne({
							attributes	: [ 'id', 'quotation_status' ],
							where		: { id: attributes.project_id },
							transaction,
						});

						if ( !project || !project.id ) {
							throw new Error( 'PROJECT_NOT_FOUND' );
						}

						if ( project.quotation_status === CONSTANTS.QUOTATION_STATUS.WAITING_APPROVAL
							|| ( project.quotation_status === CONSTANTS.QUOTATION_STATUS.APPROVED
								&& !attributes.is_extra
								&& !attributes.parent_id
								&& !attributes.vo_add_id ) ) {
							throw new Error( 'PROJECT_INVALID' );
						}

						if ( !attributes.vendor_id ) return;

						const vendor = await VendorModel.findOne({
							attributes	: [ 'id' ],
							where		: { id: attributes.vendor_id, is_disabled: false },
							transaction,
						});

						if ( !vendor || !vendor.id ) {
							throw new Error( 'VENDOR_NOT_FOUND' );
						}
					},
					async beforeUpdate( instance, { transaction } ) {
						const attributes = instance.dataValues;

						if ( _.has( attributes, 'project_id' ) ) {
							const project = await ProjectModel.findOne({
								attributes	: [ 'id', 'quotation_status' ],
								where		: { id: attributes.project_id },
								transaction,
							});

							if ( !project || !project.id ) {
								throw new Error( 'PROJECT_NOT_FOUND' );
							}

							if ( project.quotation_status === CONSTANTS.QUOTATION_STATUS.WAITING_APPROVAL
								|| ( project.quotation_status === CONSTANTS.QUOTATION_STATUS.APPROVED
									&& !attributes.is_extra ) ) {
								throw new Error( 'PROJECT_INVALID' );
							}
						}

						if ( _.has( attributes, 'vendor_id' ) ) {
							const vendor = await VendorModel.findOne({
								attributes	: [ 'id' ],
								where		: { id: attributes.vendor_id, is_disabled: false },
								transaction,
							});

							if ( !vendor || !vendor.id ) {
								throw new Error( 'VENDOR_NOT_FOUND' );
							}
						}
					},
				},
			}
		);

		try {
			ProjectModel.hasOne( ProjectCostItemModel, { foreignKey: 'project_id' } );
			ProjectCostItemModel.belongsTo( ProjectModel, { foreignKey: 'project_id' } );

			ProjectLineItemModel.hasOne( ProjectCostItemModel, { foreignKey: 'project_line_item_id' } );
			ProjectCostItemModel.belongsTo( ProjectLineItemModel, { foreignKey: 'project_line_item_id' } );

			VendorModel.hasMany( ProjectCostItemModel, { foreignKey: 'vendor_id' } );
			ProjectCostItemModel.belongsTo( VendorModel, { foreignKey: 'vendor_id' } );

			ProjectPurchaseOrderModel.hasMany( ProjectCostItemModel, { foreignKey: 'project_purchase_order_id' } );
			ProjectCostItemModel.belongsTo( ProjectPurchaseOrderModel, { foreignKey: 'project_purchase_order_id' } );

			ProjectVOModel.hasMany( ProjectCostItemModel, { foreignKey: 'vo_add_id', as: 'add_cost_by' } );
			ProjectCostItemModel.belongsTo( ProjectVOModel, { foreignKey: 'vo_add_id', as: 'add_cost_by' } );

			ProjectVOModel.hasMany( ProjectCostItemModel, { foreignKey: 'vo_delete_id', as: 'delete_cost_by' } );
			ProjectCostItemModel.belongsTo( ProjectVOModel, { foreignKey: 'vo_delete_id', as: 'delete_cost_by' } );

			CostItemCategoryModel.hasMany( ProjectCostItemModel, { foreignKey: 'cost_item_category_id' } );
			ProjectCostItemModel.belongsTo( CostItemCategoryModel, { foreignKey: 'cost_item_category_id' } );
		} catch {}

		// Cache model is associated
		BaseModel.set( channelId, 'project_cost_item', ProjectCostItemModel );

		deferred.resolve( ProjectCostItemModel );
	} catch ( error ) {
		deferred.reject( error );
	}

	return deferred.promise;
};
