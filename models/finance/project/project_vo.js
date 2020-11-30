const Sequelize = require( 'sequelize' );
const Q = require( 'q' );
const _ = require( 'underscore' );

const BaseModel = require( '@models/base' );
const Project = require( './project' );

const { CONSTANTS } = require( '@resources' );

module.exports = async channelId => {
	const deferred = Q.defer();

	try {
		let ProjectVOModel = BaseModel.get( channelId, 'project_vo' );

		if ( ProjectVOModel ) {
			deferred.resolve( ProjectVOModel );
			return deferred.promise;
		}

		const ProjectModel = await Project( channelId );

		ProjectVOModel = await BaseModel.define(
			channelId,
			'project_vo',
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
				diff_quotation_total: {
					type		: Sequelize.DOUBLE,
					defaultValue: 0,
				},
				diff_quotation_vat: {
					type		: Sequelize.DOUBLE,
					defaultValue: 0,
				},
				discount_type: {
					type		: Sequelize.STRING,
					allowNull	: false,
					defaultValue: '$',
					validate	: { len: 1 },
				},
				status: {
					type		: Sequelize.INTEGER.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { isIn: [ _.values( CONSTANTS.PROJECT_VO_STATUS ) ] },
				},
				note: Sequelize.TEXT( 'long' ),
			}
		);

		try {
			ProjectModel.hasMany( ProjectVOModel, { foreignKey: 'project_id' } );
			ProjectVOModel.belongsTo( ProjectModel, { foreignKey: 'project_id' } );
		} catch {}

		// Cache model is associated
		BaseModel.set( channelId, 'project_vo', ProjectVOModel );

		deferred.resolve( ProjectVOModel );
	} catch ( error ) {
		deferred.reject( error );
	}

	return deferred.promise;
};
