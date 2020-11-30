const Sequelize = require( 'sequelize' );
const Q = require( 'q' );
const _ = require( 'underscore' );

const BaseModel = require( '@models/base' );
const Project = require( './project' );

const { CONSTANTS } = require( '@resources' );

module.exports = async channelId => {
	const deferred = Q.defer();

	try {
		let ProjectBillModel = BaseModel.get( channelId, 'project_bill' );

		if ( ProjectBillModel ) {
			deferred.resolve( ProjectBillModel );
			return deferred.promise;
		}

		const ProjectModel = await Project( channelId );

		ProjectBillModel = await BaseModel.define(
			channelId,
			'project_bill',
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
				expected_invoice_date: {
					type		: Sequelize.DATEONLY,
					allowNull	: false,
				},
				status: {
					type		: Sequelize.INTEGER.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { isIn: [ _.values( CONSTANTS.BILL_STATUS ) ] },
				},
				transfer_type: {
					type		: Sequelize.INTEGER.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { isIn: [ _.values( CONSTANTS.TRANSFER_TYPE ) ] },
				},
				invoice_number: {
					type	: Sequelize.STRING,
					validate: { len: [ 1, 255 ] },
				},
				invoice_date	: Sequelize.DATEONLY,
				invoices		: Sequelize.TEXT( 'long' ),
				finance_note	: Sequelize.TEXT( 'long' ),
				procedures		: Sequelize.TEXT( 'long' ),
				received_date	: Sequelize.DATEONLY,
			},
			{
				setterMethods: {
					invoices( value ) {
						this.setDataValue( 'invoices', JSON.stringify( value ) );
					},
				},
				getterMethods: {
					invoices() {
						const invoices = this.getDataValue( 'invoices' );

						return invoices
							? _.sortBy( JSON.parse( invoices ), 'created_at' )
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

							if ( project.quotation_status !== CONSTANTS.QUOTATION_STATUS.APPROVED ) {
								throw new Error( 'PROJECT_INVALID' );
							}
						}
					},
				},
			}
		);

		try {
			ProjectModel.hasMany( ProjectBillModel, { foreignKey: 'project_id' } );
			ProjectBillModel.belongsTo( ProjectModel, { foreignKey: 'project_id' } );
		} catch {}

		// Cache model is associated
		BaseModel.set( channelId, 'project_bill', ProjectBillModel );

		deferred.resolve( ProjectBillModel );
	} catch ( error ) {
		deferred.reject( error );
	}

	return deferred.promise;
};
