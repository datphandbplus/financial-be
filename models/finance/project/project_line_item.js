const Sequelize = require( 'sequelize' );
const Q = require( 'q' );
const _ = require( 'underscore' );

const BaseModel = require( '@models/base' );
const LineItemCategory = require( '@models/finance/line_item_category/line_item_category' );
const ProjectSheet = require( './project_sheet' );
const ProjectVO = require( './project_vo' );

module.exports = async channelId => {
	const deferred = Q.defer();

	try {
		let ProjectLineItemModel = BaseModel.get( channelId, 'project_line_item' );

		if ( ProjectLineItemModel ) {
			deferred.resolve( ProjectLineItemModel );
			return deferred.promise;
		}

		const ProjectSheetModel = await ProjectSheet( channelId );
		const LineItemCategoryModel = await LineItemCategory( channelId );
		const ProjectVOModel = await ProjectVO( channelId );

		ProjectLineItemModel = await BaseModel.define(
			channelId,
			'project_line_item',
			{
				project_sheet_id: {
					type		: Sequelize.INTEGER,
					onUpdate	: 'CASCADE',
					onDelete	: 'SET NULL',
					references: {
						model	: ProjectSheetModel,
						key		: 'id',
					},
				},
				line_item_category_id: {
					type		: Sequelize.INTEGER,
					onUpdate	: 'CASCADE',
					onDelete	: 'SET NULL',
					references: {
						model	: LineItemCategoryModel,
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
				group: {
					type	: Sequelize.STRING,
					validate: { len: [ 0, 255 ] },
				},
				child_group: {
					type	: Sequelize.STRING,
					validate: { len: [ 0, 255 ] },
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
				note		: Sequelize.TEXT( 'long' ),
				description	: Sequelize.TEXT( 'long' ),
				image		: Sequelize.TEXT( 'long' ),
				priority	: Sequelize.TEXT( 'long' ),
			},
			{
				hooks: {
					async beforeCreate( instance, { transaction } ) {
						const attributes = instance.dataValues;
						if ( attributes.project_sheet_id ) {
							const sheet = await ProjectSheetModel.findOne({
								attributes	: [ 'id' ],
								where		: { id: attributes.project_sheet_id },
								transaction,
							});

							if ( !sheet || !sheet.id ) {
								throw new Error( 'SHEET_NOT_FOUND' );
							}
						}
					},
					async beforeUpdate( instance, { transaction } ) {
						const attributes = instance.dataValues;

						if ( _.has( attributes, 'project_sheet_id' ) ) {
							const sheet = await ProjectSheetModel.findOne({
								attributes	: [ 'id' ],
								where		: { id: attributes.project_sheet_id },
								transaction,
							});

							if ( !sheet || !sheet.id ) {
								throw new Error( 'SHEET_NOT_FOUND' );
							}
						}
					},
				},
			}
		);

		try {
			ProjectSheetModel.hasMany( ProjectLineItemModel, { foreignKey: 'project_sheet_id' } );
			ProjectLineItemModel.belongsTo( ProjectSheetModel, { foreignKey: 'project_sheet_id' } );

			ProjectVOModel.hasMany( ProjectLineItemModel, { foreignKey: 'vo_add_id', as: 'add_by' } );
			ProjectLineItemModel.belongsTo( ProjectVOModel, { foreignKey: 'vo_add_id', as: 'add_by' } );

			ProjectVOModel.hasMany( ProjectLineItemModel, { foreignKey: 'vo_delete_id', as: 'delete_by' } );
			ProjectLineItemModel.belongsTo( ProjectVOModel, { foreignKey: 'vo_delete_id', as: 'delete_by' } );

			LineItemCategoryModel.hasMany( ProjectLineItemModel, { foreignKey: 'line_item_category_id' } );
			ProjectLineItemModel.belongsTo( LineItemCategoryModel, { foreignKey: 'line_item_category_id' } );
		} catch {}

		// Cache model is associated
		BaseModel.set( channelId, 'project_line_item', ProjectLineItemModel );

		deferred.resolve( ProjectLineItemModel );
	} catch ( error ) {
		deferred.reject( error );
	}

	return deferred.promise;
};
