const Q = require( 'q' );
const Sequelize = require( 'sequelize' );
const _ = require( 'underscore' );

const ProjectRepository = require( '@models/finance/project/project_repository' );
const LezoProjectRepository = require( '@models/ext/lezo/lezo_project_repository' );

const { Logger, Account, Authentication } = require( '@helpers' );

const Op = Sequelize.Op;

class LezoProjectHandler {

	/**
	* @constructor
	* @param {string} channelId
	* @param {object} userData
	*/
	constructor( channelId, userData = null ) {
		this.channelId = channelId;
		this.currentUser = userData;
		this.account = new Account( userData );
	}

	/**
	* Handle get Lezo employees
	* @return {promise}
	*/
	async handleGetAll() {
		const deferred = Q.defer();

		try {
			if ( !await new Authentication( this.channelId ).checkAppAvailable( 'lezo' ) ) {
				deferred.resolve( [] );
				return deferred.promise;
			}

			const results = await Q.all([
				new LezoProjectRepository( this.channelId ).getAll(),
				new ProjectRepository( this.channelId ).getAll({
					where: {
						lezo_project_id: { [ Op.ne ]: null },
					},
				}),
			]);
			const projects = _.map( results[ 1 ], 'lezo_project_id' );

			return _.filter( results[ 0 ], item => !_.include( projects, item.id ) );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

}

module.exports = LezoProjectHandler;
