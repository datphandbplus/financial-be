const Sequelize = require( 'sequelize' );
const Q = require( 'q' );

const BaseModel = require( '@models/base' );
const Project = require( './project' );

const { CONSTANTS } = require( '@resources' );

module.exports = async channelId => {
	const deferred = Q.defer();

	try {
		let ProjectBillPlanModel = BaseModel.get( channelId, 'project_bill_plan' );

		if ( ProjectBillPlanModel ) {
			deferred.resolve( ProjectBillPlanModel );
			return deferred.promise;
		}

		const ProjectModel = await Project( channelId );

		ProjectBillPlanModel = await BaseModel.define(
			channelId,
			'project_bill_plan',
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
				target_date: {
					type		: Sequelize.DATEONLY,
					allowNull	: false,
				},
				target_percent: {
					type		: Sequelize.INTEGER.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { min: 0, max: 100 },
				},
				note			: Sequelize.TEXT( 'long' ),
			},
			{
				hooks: {
					async beforeCreate( instance, { transaction } ) {
						const attributes = instance.dataValues;
						const project = await ProjectModel.findOne({
							attributes	: [ 'id', 'quotation_status', 'bill_plan_status' ],
							where		: { id: attributes.project_id },
							transaction,
						});

						if ( !project || !project.id ) {
							throw new Error( 'PROJECT_NOT_FOUND' );
						}

						if ( project.quotation_status !== CONSTANTS.QUOTATION_STATUS.APPROVED
							|| project.bill_plan_status === CONSTANTS.PLAN_STATUS.APPROVED
							|| project.bill_plan_status === CONSTANTS.PLAN_STATUS.WAITING_APPROVAL ) {
							throw new Error( 'PROJECT_INVALID' );
						}
					},
					async beforeUpdate( instance, { transaction } ) {
						const attributes = instance.dataValues;
						const project = await ProjectModel.findOne({
							attributes	: [ 'id', 'quotation_status', 'bill_plan_status' ],
							where		: { id: attributes.project_id },
							transaction,
						});

						if ( !project || !project.id ) {
							throw new Error( 'PROJECT_NOT_FOUND' );
						}

						if ( project.quotation_status !== CONSTANTS.QUOTATION_STATUS.APPROVED
							|| project.bill_plan_status === CONSTANTS.PLAN_STATUS.APPROVED
							|| project.bill_plan_status === CONSTANTS.PLAN_STATUS.WAITING_APPROVAL ) {
							throw new Error( 'PROJECT_INVALID' );
						}
					},
				},
			}
		);

		try {
			ProjectModel.hasMany( ProjectBillPlanModel, { foreignKey: 'project_id' } );
			ProjectBillPlanModel.belongsTo( ProjectModel, { foreignKey: 'project_id' } );
		} catch {}

		// Cache model is associated
		BaseModel.set( channelId, 'project_bill_plan', ProjectBillPlanModel );

		deferred.resolve( ProjectBillPlanModel );
	} catch ( error ) {
		deferred.reject( error );
	}

	return deferred.promise;
};
