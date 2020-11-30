const ProjectBillPlan = require( './project_bill_plan' );
const Repository = require( '@models/repository' );

class ProjectBillPlanRepository extends Repository {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		super( ProjectBillPlan( channelId ) );
	}

}

module.exports = ProjectBillPlanRepository;
