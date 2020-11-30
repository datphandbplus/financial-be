const Sequelize = require( 'sequelize' );
const Q = require( 'q' );
const _ = require( 'underscore' );

const BaseModel = require( '@models/base' );
const Project = require( './project' );
const ProjectPurchaseOrder = require( './project_purchase_order' );

const { CONSTANTS } = require( '@resources' );

module.exports = async channelId => {
	const deferred = Q.defer();

	try {
		let ProjectPaymentModel = BaseModel.get( channelId, 'project_payment' );

		if ( ProjectPaymentModel ) {
			deferred.resolve( ProjectPaymentModel );
			return deferred.promise;
		}

		const ProjectModel = await Project( channelId );
		const ProjectPurchaseOrderModel = await ProjectPurchaseOrder( channelId );

		ProjectPaymentModel = await BaseModel.define(
			channelId,
			'project_payment',
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
				name: {
					type		: Sequelize.STRING,
					allowNull	: false,
					validate	: { len: [ 1, 255 ] },
				},
				total: {
					type		: Sequelize.DOUBLE.UNSIGNED,
					defaultValue: 0,
					validate	: { min: 0 },
				},
				total_vat: {
					type		: Sequelize.DOUBLE.UNSIGNED,
					defaultValue: 0,
					validate	: { min: 0 },
				},
				total_real: {
					type		: Sequelize.DOUBLE.UNSIGNED,
					defaultValue: 0,
					validate	: { min: 0 },
				},
				total_vat_real: {
					type		: Sequelize.DOUBLE.UNSIGNED,
					defaultValue: 0,
					validate	: { min: 0 },
				},
				vendor_name: {
					type		: Sequelize.STRING,
					allowNull	: false,
					validate	: { len: [ 1, 255 ] },
				},
				vendor_payment_term: {
					type		: Sequelize.INTEGER.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { min: 0 },
				},
				invoice_number: {
					type		: Sequelize.STRING,
					validate	: { len: [ 1, 255 ] },
				},
				invoice_date: {
					type		: Sequelize.DATEONLY,
					allowNull	: false,
				},
				invoices	: Sequelize.TEXT( 'long' ),
				status: {
					type		: Sequelize.INTEGER.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { isIn: [ _.values( CONSTANTS.PAYMENT_STATUS ) ] },
				},
				approve_status: {
					type		: Sequelize.INTEGER.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { isIn: [ _.values( CONSTANTS.PAYMENT_APPROVE_STATUS ) ] },
				},
				transfer_type: {
					type		: Sequelize.INTEGER.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { isIn: [ _.values( CONSTANTS.TRANSFER_TYPE ) ] },
				},
				payment_order_number: {
					type		: Sequelize.STRING,
					validate	: { len: [ 1, 255 ] },
				},
				payment_order_date	: Sequelize.DATEONLY,
				payment_orders		: Sequelize.TEXT( 'long' ),
				paid_date			: Sequelize.DATEONLY,
				finance_note		: Sequelize.TEXT( 'long' ),
				procedures			: Sequelize.TEXT( 'long' ),
			},
			{
				setterMethods: {
					invoices( value ) {
						this.setDataValue( 'invoices', JSON.stringify( value ) );
					},
					payment_orders( value ) {
						this.setDataValue( 'payment_orders', JSON.stringify( value ) );
					},
				},
				getterMethods: {
					invoices() {
						const invoices = this.getDataValue( 'invoices' );

						return invoices
							? _.sortBy( JSON.parse( invoices ), 'created_at' )
							: undefined;
					},
					payment_orders() {
						const paymentOrders = this.getDataValue( 'payment_orders' );

						return paymentOrders
							? _.sortBy( JSON.parse( paymentOrders ), 'created_at' )
							: undefined;
					},
					procedures() {
						const procedures = this.getDataValue( 'procedures' );
						return JSON.parse( procedures || '[]' );
					},
				},
				hooks: {
					async beforeCreate( instance, { transaction } ) {
						const attributes = instance.dataValues;
						const project = await ProjectModel.findOne({
							attributes	: [ 'id', 'quotation_status', 'project_status' ],
							where		: { id: attributes.project_id },
							transaction,
						});

						if ( !project || !project.id ) {
							throw new Error( 'PROJECT_NOT_FOUND' );
						}

						if ( project.quotation_status !== CONSTANTS.QUOTATION_STATUS.APPROVED
							|| _.contains(
								[
									CONSTANTS.PROJECT_STATUS.PITCHING,
									CONSTANTS.PROJECT_STATUS.DELAYED,
									CONSTANTS.PROJECT_STATUS.FAIL,
									CONSTANTS.PROJECT_STATUS.DROPPED,
								],
								project.project_status
							) ) {
							throw new Error( 'PROJECT_INVALID' );
						}

						const projectPO = await ProjectPurchaseOrderModel.findOne({
							attributes	: [ 'id', 'status' ],
							where		: { id: attributes.project_purchase_order_id },
							transaction,
						});

						if ( !projectPO || !projectPO.id ) {
							throw new Error( 'PROJECT_PURCHASE_ORDER_NOT_FOUND' );
						}

						if ( projectPO.status !== CONSTANTS.PURCHASE_ORDER_STATUS.APPROVED ) {
							throw new Error( 'PROJECT_PURCHASE_ORDER_INVALID' );
						}
					},
					async beforeUpdate( instance, { transaction } ) {
						const attributes = instance.dataValues;

						if ( _.has( attributes, 'project_id' ) ) {
							const project = await ProjectModel.findOne({
								attributes	: [ 'id', 'quotation_status', 'project_status' ],
								where		: { id: attributes.project_id },
								transaction,
							});

							if ( !project || !project.id ) {
								throw new Error( 'PROJECT_NOT_FOUND' );
							}

							if ( project.quotation_status !== CONSTANTS.QUOTATION_STATUS.APPROVED
								|| _.contains(
									[
										CONSTANTS.PROJECT_STATUS.PITCHING,
										CONSTANTS.PROJECT_STATUS.DELAYED,
										CONSTANTS.PROJECT_STATUS.FAIL,
										CONSTANTS.PROJECT_STATUS.DROPPED,
									],
									project.project_status
								) ) {
								throw new Error( 'PROJECT_INVALID' );
							}
						}

						if ( _.has( attributes, 'project_purchase_order_id' ) ) {
							const projectPO = await ProjectPurchaseOrderModel.findOne({
								attributes	: [ 'id', 'status' ],
								where		: { id: attributes.project_purchase_order_id },
								transaction,
							});

							if ( !projectPO || !projectPO.id ) {
								throw new Error( 'PROJECT_PURCHASE_ORDER_NOT_FOUND' );
							}

							if ( projectPO.status !== CONSTANTS.PURCHASE_ORDER_STATUS.APPROVED ) {
								throw new Error( 'PROJECT_PURCHASE_ORDER_INVALID' );
							}
						}
					},
				},
			}
		);

		try {
			ProjectModel.hasMany( ProjectPaymentModel, { foreignKey: 'project_id' } );
			ProjectPaymentModel.belongsTo( ProjectModel, { foreignKey: 'project_id' } );

			ProjectPurchaseOrderModel.hasMany( ProjectPaymentModel, { foreignKey: 'project_purchase_order_id' } );
			ProjectPaymentModel.belongsTo( ProjectPurchaseOrderModel, { foreignKey: 'project_purchase_order_id' } );
		} catch {}

		// Cache model is associated
		BaseModel.set( channelId, 'project_payment', ProjectPaymentModel );

		deferred.resolve( ProjectPaymentModel );
	} catch ( error ) {
		deferred.reject( error );
	}

	return deferred.promise;
};
