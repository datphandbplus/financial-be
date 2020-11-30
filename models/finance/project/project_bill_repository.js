const ProjectBill = require( './project_bill' );
const Repository = require( '@models/repository' );

class ProjectBillRepository extends Repository {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		super( ProjectBill( channelId ) );
	}

}

module.exports = ProjectBillRepository;
