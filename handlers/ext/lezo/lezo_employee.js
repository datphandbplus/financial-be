const Q = require( 'q' );
const Sequelize = require( 'sequelize' );
const _ = require( 'underscore' );

const UserRepository = require( '@models/finance/user/user_repository' );
const LezoEmployeeRepository = require( '@models/ext/lezo/lezo_employee_repository' );

const { Logger, Account, Authentication } = require( '@helpers' );
const { CONSTANTS } = require( '@resources' );

const Op = Sequelize.Op;

class LezoEmployeeHandler {

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
				new LezoEmployeeRepository( this.channelId ).getAll({
					where: {
						is_owner: false,
						status	: { [ Op.ne ]: CONSTANTS.LEZO_RESIGNED_EMPLOYEE_STATUS },
					},
				}),
				new UserRepository( this.channelId ).getAll({
					where: {
						lezo_employee_id: { [ Op.ne ]: null },
					},
				}),
			]);
			const users = _.map( results[ 1 ], 'email' );

			return _.filter( results[ 0 ], item => !_.include( users, item.email ) );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

}

module.exports = LezoEmployeeHandler;
