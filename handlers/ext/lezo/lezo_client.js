const Q = require( 'q' );
const Sequelize = require( 'sequelize' );
const _ = require( 'underscore' );

const ClientRepository = require( '@models/finance/client/client_repository' );
const LezoClientRepository = require( '@models/ext/lezo/lezo_client_repository' );

const { Logger, Account, Authentication } = require( '@helpers' );

const Op = Sequelize.Op;

class LezoClientHandler {

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
				new LezoClientRepository( this.channelId ).getAll(),
				new ClientRepository( this.channelId ).getAll({
					where: {
						lezo_client_id: { [ Op.ne ]: null },
					},
				}),
			]);
			const clients = _.map( results[ 1 ], 'lezo_client_id' );

			return _.filter( results[ 0 ], item => !_.include( clients, item.id ) );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

}

module.exports = LezoClientHandler;
