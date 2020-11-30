const Sequelize = require( 'sequelize' );
const Q = require( 'q' );
const _ = require( 'underscore' );

const BaseModel = require( '@models/base' );
const User = require( '@models/finance/user/user' );
const UserRole = require( '@models/finance/user/user_role' );
const ProjectVO = require( './project_vo' );

const { CONSTANTS } = require( '@resources' );

module.exports = async channelId => {
	const deferred = Q.defer();

	try {
		let VOApproverModel = BaseModel.get( channelId, 'vo_approver' );

		if ( VOApproverModel ) {
			deferred.resolve( VOApproverModel );
			return deferred.promise;
		}

		const ProjectVOModel = await ProjectVO( channelId );
		const UserModel = await User( channelId );
		const UserRoleModel = await UserRole( channelId );

		VOApproverModel = await BaseModel.define(
			channelId,
			'vo_approver',
			{
				project_vo_id: {
					type		: Sequelize.INTEGER,
					onUpdate	: 'CASCADE',
					onDelete	: 'CASCADE',
					allowNull	: false,
					references: {
						model	: ProjectVOModel,
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
				role_key: {
					type	: Sequelize.STRING,
					onUpdate: 'CASCADE',
					onDelete: 'SET NULL',
					references: {
						model	: UserRoleModel,
						key		: 'key',
					},
				},
				status: {
					type		: Sequelize.INTEGER.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { isIn: [ _.values( CONSTANTS.VO_APPROVE_STATUS ) ] },
				},
				approved_at	: Sequelize.DATE,
				comment		: Sequelize.TEXT( 'long' ),
			}
		);

		try {
			ProjectVOModel.hasMany( VOApproverModel, { foreignKey: 'project_vo_id' } );
			VOApproverModel.belongsTo( ProjectVOModel, { foreignKey: 'project_vo_id' } );

			UserModel.hasMany( VOApproverModel, { foreignKey: 'user_id' } );
			VOApproverModel.belongsTo( UserModel, { foreignKey: 'user_id' } );

			UserRoleModel.hasMany( VOApproverModel, { foreignKey: 'role_key' } );
			VOApproverModel.belongsTo( UserRoleModel, { foreignKey: 'role_key' } );
		} catch {}

		// Cache model is associated
		BaseModel.set( channelId, 'vo_approver', VOApproverModel );

		deferred.resolve( VOApproverModel );
	} catch ( error ) {
		deferred.reject( error );
	}

	return deferred.promise;
};
