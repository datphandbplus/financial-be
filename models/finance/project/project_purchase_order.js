const Sequelize = require( 'sequelize' );
const Q = require( 'q' );
const _ = require( 'underscore' );

const BaseModel = require( '@models/base' );
const Vendor = require( '@models/finance/vendor/vendor' );
const Project = require( './project' );

const { CONSTANTS } = require( '@resources' );

module.exports = async channelId => {
	const deferred = Q.defer();

	try {
		let ProjectPurchaseOrderModel = BaseModel.get( channelId, 'project_purchase_order' );

		if ( ProjectPurchaseOrderModel ) {
			deferred.resolve( ProjectPurchaseOrderModel );
			return deferred.promise;
		}

		const ProjectModel = await Project( channelId );
		const VendorModel = await Vendor( channelId );

		ProjectPurchaseOrderModel = await BaseModel.define(
			channelId,
			'project_purchase_order',
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
				vendor_id: {
					type		: Sequelize.INTEGER,
					onUpdate	: 'CASCADE',
					onDelete	: 'SET NULL',
					references: {
						model	: VendorModel,
						key		: 'id',
					},
				},
				vat_percent: {
					type		: Sequelize.DOUBLE.UNSIGNED,
					defaultValue: 0,
					validate	: { min: 0, max: 100 },
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
				discount_amount_bk: {
					type		: Sequelize.DOUBLE.UNSIGNED,
					defaultValue: 0,
					validate	: { min: 0 },
				},
				discount_type_bk: {
					type		: Sequelize.STRING,
					allowNull	: false,
					defaultValue: '$',
					validate	: { len: 1 },
				},
				name: {
					type		: Sequelize.STRING,
					allowNull	: false,
					validate	: { len: [ 1, 255 ] },
				},
				status: {
					type		: Sequelize.INTEGER.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { isIn: [ _.values( CONSTANTS.PURCHASE_ORDER_STATUS ) ] },
				},
				old_status: {
					type		: Sequelize.INTEGER.UNSIGNED,
					validate	: { isIn: [ _.values( CONSTANTS.PURCHASE_ORDER_STATUS ) ] },
				},
				old_data	: Sequelize.TEXT( 'long' ),
				new_data	: Sequelize.TEXT( 'long' ),
				description	: Sequelize.TEXT( 'long' ),
				note		: Sequelize.TEXT( 'long' ),
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

						if ( project.quotation_status !== CONSTANTS.QUOTATION_STATUS.APPROVED ) {
							throw new Error( 'PROJECT_INVALID' );
						}

						const vendor = await VendorModel.findOne({
							attributes	: [ 'id' ],
							where		: { id: attributes.vendor_id },
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

							if ( project.quotation_status === CONSTANTS.QUOTATION_STATUS.APPROVED ) {
								throw new Error( 'PROJECT_INVALID' );
							}
						}

						if ( _.has( attributes, 'vendor_id' ) ) {
							const vendor = await VendorModel.findOne({
								attributes	: [ 'id' ],
								where		: { id: attributes.vendor_id },
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
			ProjectModel.hasMany( ProjectPurchaseOrderModel, { foreignKey: 'project_id' } );
			ProjectPurchaseOrderModel.belongsTo( ProjectModel, { foreignKey: 'project_id' } );

			VendorModel.hasMany( ProjectPurchaseOrderModel, { foreignKey: 'vendor_id' } );
			ProjectPurchaseOrderModel.belongsTo( VendorModel, { foreignKey: 'vendor_id' } );
		} catch {}

		// Cache model is associated
		BaseModel.set( channelId, 'project_purchase_order', ProjectPurchaseOrderModel );

		deferred.resolve( ProjectPurchaseOrderModel );
	} catch ( error ) {
		deferred.reject( error );
	}

	return deferred.promise;
};
