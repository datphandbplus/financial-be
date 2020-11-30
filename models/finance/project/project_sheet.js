const Sequelize = require( 'sequelize' );
const Q = require( 'q' );
const _ = require( 'underscore' );

const BaseModel = require( '@models/base' );
const Project = require( './project' );

const { CONSTANTS } = require( '@resources' );

module.exports = async channelId => {
	const deferred = Q.defer();

	try {
		let ProjectSheetModel = BaseModel.get( channelId, 'project_sheet' );

		if ( ProjectSheetModel ) {
			deferred.resolve( ProjectSheetModel );
			return deferred.promise;
		}

		const ProjectModel = await Project( channelId );

		ProjectSheetModel = await BaseModel.define(
			channelId,
			'project_sheet',
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

						if ( project.quotation_status === CONSTANTS.QUOTATION_STATUS.WAITING_APPROVAL
							|| project.quotation_status === CONSTANTS.QUOTATION_STATUS.APPROVED ) {
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

							if ( project.quotation_status === CONSTANTS.QUOTATION_STATUS.WAITING_APPROVAL
								|| project.quotation_status === CONSTANTS.QUOTATION_STATUS.APPROVED ) {
								throw new Error( 'PROJECT_INVALID' );
							}
						}
					},
				},
			}
		);

		try {
			ProjectModel.hasMany( ProjectSheetModel, { foreignKey: 'project_id' } );
			ProjectSheetModel.belongsTo( ProjectModel, { foreignKey: 'project_id' } );
		} catch {}

		// Cache model is associated
		BaseModel.set( channelId, 'project_sheet', ProjectSheetModel );

		deferred.resolve( ProjectSheetModel );
	} catch ( error ) {
		deferred.reject( error );
	}

	return deferred.promise;
};
