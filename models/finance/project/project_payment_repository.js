const ProjectPayment = require( './project_payment' );
const Repository = require( '@models/repository' );

class ProjectPaymentRepository extends Repository {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		super( ProjectPayment( channelId ) );
	}

}

module.exports = ProjectPaymentRepository;
