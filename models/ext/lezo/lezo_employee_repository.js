const LezoEmployee = require( './lezo_employee' );
const Repository = require( '@models/repository' );

class LezoEmployeeRepository extends Repository {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		super( LezoEmployee( channelId ) );
	}

}

module.exports = LezoEmployeeRepository;
