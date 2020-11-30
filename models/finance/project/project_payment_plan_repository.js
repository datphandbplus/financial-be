const ProjectPaymentPlan = require( './project_payment_plan' );
const Repository = require( '@models/repository' );

class ProjectPaymentPlanRepository extends Repository {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		super( ProjectPaymentPlan( channelId ) );
	}

}

module.exports = ProjectPaymentPlanRepository;
