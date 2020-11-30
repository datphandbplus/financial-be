const Sequelize = require( 'sequelize' );
const Q = require( 'q' );
const _ = require( 'underscore' );

const BaseModel = require( '@models/base' );
const User = require( '@models/finance/user/user' );
const Project = require( './project' );

const { CONSTANTS } = require( '@resources' );

module.exports = async channelId => {
	const deferred = Q.defer();

	try {
		let ProjectApproverModel = BaseModel.get( channelId, 'project_approver' );

		if ( ProjectApproverModel ) {
			deferred.resolve( ProjectApproverModel );
			return deferred.promise;
		}

		const ProjectModel = await Project( channelId );
		const UserModel = await User( channelId );

		ProjectApproverModel = await BaseModel.define(
			channelId,
			'project_approver',
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
				user_id: {
					type	: Sequelize.INTEGER,
					onUpdate: 'CASCADE',
					onDelete: 'SET NULL',
					references: {
						model	: UserModel,
						key		: 'id',
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
			ProjectModel.hasMany( ProjectApproverModel, { foreignKey: 'project_id' } );
			ProjectApproverModel.belongsTo( ProjectModel, { foreignKey: 'project_id' } );

			UserModel.hasMany( ProjectApproverModel, { foreignKey: 'user_id' } );
			ProjectApproverModel.belongsTo( UserModel, { foreignKey: 'user_id' } );
		} catch {}

		// Cache model is associated
		BaseModel.set( channelId, 'project_approver', ProjectApproverModel );

		deferred.resolve( ProjectApproverModel );
	} catch ( error ) {
		deferred.reject( error );
	}

	return deferred.promise;
};
